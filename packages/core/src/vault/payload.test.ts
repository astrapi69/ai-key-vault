import { describe, expect, it } from "vitest";

import {
    buildKeyVaultPayload,
    hasExportableKey,
    normalizeKeyVaultPayload,
    presentKeys,
} from "./payload";

const IDS = ["anthropic", "openai", "gemini"] as const;
type Id = (typeof IDS)[number];

describe("presentKeys / hasExportableKey", () => {
    it("drops empty and whitespace-only keys", () => {
        const raw = { anthropic: "sk-ant-x", openai: "   ", gemini: "" };
        expect(presentKeys(IDS, raw)).toEqual({ anthropic: "sk-ant-x" });
        expect(hasExportableKey(IDS, raw)).toBe(true);
        expect(hasExportableKey(IDS, { openai: " " })).toBe(false);
    });

    it("ignores keys for providers outside the registry", () => {
        const raw = { anthropic: "sk-ant-x", mistral: "m-key" } as Record<string, string>;
        expect(presentKeys(IDS, raw)).toEqual({ anthropic: "sk-ant-x" });
    });
});

describe("buildKeyVaultPayload", () => {
    it("carries present keys plus active provider and per-provider model overrides", () => {
        const payload = buildKeyVaultPayload(IDS, { anthropic: "sk-ant-x" }, {
            activeProvider: "anthropic",
            modelOverride: { anthropic: "claude-x", openai: null },
        });
        expect(payload).toEqual({
            keys: { anthropic: "sk-ant-x" },
            providerSettings: {
                activeProvider: "anthropic",
                modelOverride: { anthropic: "claude-x", openai: null, gemini: null },
            },
        });
    });
});

describe("normalizeKeyVaultPayload", () => {
    it("accepts the generic payload shape", () => {
        const payload = {
            keys: { openai: "sk-abc" },
            providerSettings: {
                activeProvider: "openai",
                modelOverride: { openai: "gpt-4o" },
            },
        };
        const normalized = normalizeKeyVaultPayload<Id>(IDS, payload);
        expect(normalized?.keys).toEqual({ openai: "sk-abc" });
        expect(normalized?.providerSettings.activeProvider).toBe("openai");
        expect(normalized?.providerSettings.modelOverride.openai).toBe("gpt-4o");
    });

    it("normalizes the legacy adaptive-learner payload shape (snake_case fixed fields)", () => {
        const legacy = {
            keys: { anthropic: "sk-ant-x", gemini: "AIza-key-value-123" },
            providerSettings: {
                active_provider: "gemini",
                model_override_anthropic: "claude-x",
                model_override_openai: null,
                model_override_gemini: "gemini-2.0-flash",
            },
        };
        const normalized = normalizeKeyVaultPayload<Id>(IDS, legacy);
        expect(normalized).not.toBeNull();
        expect(normalized?.keys).toEqual({
            anthropic: "sk-ant-x",
            gemini: "AIza-key-value-123",
        });
        expect(normalized?.providerSettings).toEqual({
            activeProvider: "gemini",
            modelOverride: {
                anthropic: "claude-x",
                openai: null,
                gemini: "gemini-2.0-flash",
            },
        });
    });

    it("rejects foreign shapes, unknown providers and non-string keys", () => {
        expect(normalizeKeyVaultPayload(IDS, null)).toBeNull();
        expect(normalizeKeyVaultPayload(IDS, "text")).toBeNull();
        expect(normalizeKeyVaultPayload(IDS, {})).toBeNull();
        expect(
            normalizeKeyVaultPayload(IDS, { keys: { evil: "x" }, providerSettings: {} }),
        ).toBeNull();
        expect(
            normalizeKeyVaultPayload(IDS, { keys: { openai: 42 }, providerSettings: {} }),
        ).toBeNull();
    });

    it("treats an unknown active provider as null instead of importing it", () => {
        const normalized = normalizeKeyVaultPayload<Id>(IDS, {
            keys: {},
            providerSettings: { activeProvider: "mistral", modelOverride: {} },
        });
        expect(normalized?.providerSettings.activeProvider).toBeNull();
    });
});
