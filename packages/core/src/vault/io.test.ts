import { describe, expect, it } from "vitest";
import { VaultDecryptError, encryptToVault } from "@astrapi69/passphrase-vault";

import type { AiKeyStoreAdapter, AiSettingsSnapshot } from "../storage/adapter";
import { buildEncryptedKeyVault, importEncryptedKeyVault } from "./io";

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

    it("supports a custom envelope format end to end", async () => {
        const source = makeAdapter({ openai: "sk-abc" });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "pw", {
            providerIds: IDS,
            format: "my-app-keys",
        });
        const target = makeAdapter({});
        await expect(
            importEncryptedKeyVault(target.adapter, "u1", envelope!, "pw", {
                providerIds: IDS,
            }),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        const result = await importEncryptedKeyVault(target.adapter, "u1", envelope!, "pw", {
            providerIds: IDS,
            format: "my-app-keys",
        });
        expect(result.providers).toEqual(["openai"]);
    });
});
