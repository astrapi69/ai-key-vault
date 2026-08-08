import { describe, expect, it } from "vitest";
import { VaultDecryptError, encryptToVault } from "@astrapi69/passphrase-vault";

import type { AiKeyStoreAdapter, AiSettingsSnapshot } from "../storage/adapter";
import { buildEncryptedKeyVault, importEncryptedKeyVault } from "./io";
import { buildKeyVaultPayload } from "./payload";

const IDS = ["anthropic", "openai", "gemini"] as const;
type Id = (typeof IDS)[number];

/** In-memory mock adapter — the storage-agnostic seam under test. */
function makeAdapter(initialKeys: Partial<Record<Id, string>> = {}) {
    const keys: Partial<Record<Id, string>> = { ...initialKeys };
    let activeProvider: Id | null = null;
    let modelOverride: Partial<Record<Id, string | null>> = {};
    const snapshot = (): AiSettingsSnapshot<Id> => ({
        activeProvider,
        hasKey: {
            anthropic: Boolean(keys.anthropic),
            openai: Boolean(keys.openai),
            gemini: Boolean(keys.gemini),
        },
        keySource: {
            anthropic: keys.anthropic ? "settings" : "none",
            openai: keys.openai ? "settings" : "none",
            gemini: keys.gemini ? "settings" : "none",
        },
        keyPreview: {},
        modelOverride: { ...modelOverride },
    });
    const adapter: AiKeyStoreAdapter<Id> = {
        capabilities: { clientReadableKeys: true, keyBackup: false, liveTest: false },
        getSettings: async () => snapshot(),
        patchSettings: async (_userId, patch) => {
            if ("activeProvider" in patch) activeProvider = patch.activeProvider ?? null;
            if (patch.modelOverride) {
                modelOverride = { ...modelOverride, ...patch.modelOverride };
            }
            return snapshot();
        },
        setApiKey: async (_userId, provider, key) => {
            keys[provider] = key;
            return snapshot();
        },
        deleteApiKey: async (_userId, provider) => {
            delete keys[provider];
            return snapshot();
        },
        exportApiKeys: async () => ({ ...keys }),
    };
    return {
        adapter,
        state: {
            keys,
            get activeProvider() {
                return activeProvider;
            },
            get modelOverride() {
                return modelOverride;
            },
        },
    };
}

describe("buildEncryptedKeyVault", () => {
    it("returns null when no exportable key exists", async () => {
        const { adapter } = makeAdapter({});
        expect(
            await buildEncryptedKeyVault(adapter, "u1", "pw", { providerIds: IDS }),
        ).toBeNull();
    });

    it("exports and re-imports through a second adapter (full round-trip)", async () => {
        const source = makeAdapter({ anthropic: "sk-ant-x", openai: "sk-abc" });
        await source.adapter.patchSettings("u1", {
            activeProvider: "openai",
            modelOverride: { openai: "gpt-4o" },
        });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "pw", {
            providerIds: IDS,
        });
        expect(envelope).not.toBeNull();

        const target = makeAdapter({});
        const result = await importEncryptedKeyVault(target.adapter, "u2", envelope!, "pw", {
            providerIds: IDS,
        });
        expect(result.providers.sort()).toEqual(["anthropic", "openai"]);
        expect(target.state.keys).toEqual({ anthropic: "sk-ant-x", openai: "sk-abc" });
        expect(target.state.activeProvider).toBe("openai");
        expect(target.state.modelOverride).toEqual({
            anthropic: null,
            openai: "gpt-4o",
            gemini: null,
        });
    });
});

describe("importEncryptedKeyVault", () => {
    it("imports a LEGACY adaptive-learner payload (backward compat with old .alk files)", async () => {
        const legacyPayload = {
            keys: { gemini: "AIza-key-value-123" },
            providerSettings: {
                active_provider: "gemini",
                model_override_anthropic: null,
                model_override_openai: null,
                model_override_gemini: "gemini-2.0-flash",
            },
        };
        const envelope = await encryptToVault(legacyPayload, "pw");
        const target = makeAdapter({});
        const result = await importEncryptedKeyVault(target.adapter, "u1", envelope, "pw", {
            providerIds: IDS,
        });
        expect(result.providers).toEqual(["gemini"]);
        expect(target.state.keys).toEqual({ gemini: "AIza-key-value-123" });
        expect(target.state.activeProvider).toBe("gemini");
        expect(target.state.modelOverride.gemini).toBe("gemini-2.0-flash");
    });

    it("throws VaultDecryptError and writes NOTHING for a wrong passphrase", async () => {
        const source = makeAdapter({ anthropic: "sk-ant-x" });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "pw", {
            providerIds: IDS,
        });
        const target = makeAdapter({});
        await expect(
            importEncryptedKeyVault(target.adapter, "u1", envelope!, "WRONG", {
                providerIds: IDS,
            }),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        expect(target.state.keys).toEqual({});
        expect(target.state.activeProvider).toBeNull();
    });

    it("throws VaultDecryptError for a valid envelope with a foreign payload shape", async () => {
        const envelope = await encryptToVault({ some: "other-app-data" }, "pw");
        const target = makeAdapter({});
        await expect(
            importEncryptedKeyVault(target.adapter, "u1", envelope, "pw", {
                providerIds: IDS,
            }),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        expect(target.state.keys).toEqual({});
    });

    it("stamps a custom envelope format on export", async () => {
        const source = makeAdapter({ openai: "sk-abc" });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "pw", {
            providerIds: IDS,
            format: "my-app-keys",
        });
        expect(JSON.parse(envelope!).format).toBe("my-app-keys");
    });

    it("imports format-agnostically: a sibling app's format opens without naming it", async () => {
        const source = makeAdapter({ openai: "sk-abc" });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "pw", {
            providerIds: IDS,
            format: "sibling-app-keys",
        });
        // Neither omitting the format nor giving a DIFFERENT host format
        // blocks the import: it decrypts with the file's OWN declared format.
        const target1 = makeAdapter({});
        const r1 = await importEncryptedKeyVault(target1.adapter, "u1", envelope!, "pw", {
            providerIds: IDS,
        });
        expect(r1.providers).toEqual(["openai"]);

        const target2 = makeAdapter({});
        const r2 = await importEncryptedKeyVault(target2.adapter, "u1", envelope!, "pw", {
            providerIds: IDS,
            format: "this-host-format",
        });
        expect(r2.providers).toEqual(["openai"]);
    });

    it("still rejects a wrong passphrase regardless of format", async () => {
        const source = makeAdapter({ openai: "sk-abc" });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "correct-pw", {
            providerIds: IDS,
            format: "sibling-app-keys",
        });
        const target = makeAdapter({});
        await expect(
            importEncryptedKeyVault(target.adapter, "u1", envelope!, "wrong-pw", {
                providerIds: IDS,
            }),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        expect(target.state.keys).toEqual({});
    });

    it("remaps a sibling app's provider id via providerAliases (gemini -> google)", async () => {
        // Source app names the provider "gemini"; this host names it "google".
        const payload = buildKeyVaultPayload(
            ["anthropic", "openai", "gemini"] as const,
            { gemini: "AIza-key", anthropic: "sk-ant" },
            { activeProvider: "gemini", modelOverride: {} },
        );
        const envelope = await encryptToVault(payload, "pw", { format: "sibling-app-keys" });

        // A minimal host adapter that knows "google", not "gemini".
        type HostId = "anthropic" | "openai" | "google";
        const stored: Partial<Record<HostId, string>> = {};
        let active: HostId | null = null;
        const emptySnapshot = (): AiSettingsSnapshot<HostId> => ({
            activeProvider: active,
            hasKey: { anthropic: false, openai: false, google: false },
            keySource: { anthropic: "none", openai: "none", google: "none" },
            keyPreview: {},
            modelOverride: {},
        });
        const host: AiKeyStoreAdapter<HostId> = {
            capabilities: { clientReadableKeys: true, keyBackup: false, liveTest: false },
            getSettings: async () => emptySnapshot(),
            patchSettings: async (_u, patch) => {
                if ("activeProvider" in patch) active = patch.activeProvider ?? null;
                return emptySnapshot();
            },
            setApiKey: async (_u, provider, key) => {
                stored[provider] = key;
                return emptySnapshot();
            },
            deleteApiKey: async () => emptySnapshot(),
            exportApiKeys: async () => ({ ...stored }),
        };

        const result = await importEncryptedKeyVault(host, "u1", envelope, "pw", {
            providerIds: ["anthropic", "openai", "google"],
            providerAliases: { gemini: "google" },
        });
        expect(result.providers).toContain("google");
        expect(stored.google).toBe("AIza-key");
        expect(stored.anthropic).toBe("sk-ant");
        expect(active).toBe("google");
    });
});
