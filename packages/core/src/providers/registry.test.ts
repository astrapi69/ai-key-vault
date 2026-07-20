import { describe, expect, it } from "vitest";

import {
    BUILTIN_PROVIDERS,
    DEFAULT_MODELS,
    createProviderRegistry,
    providerRequiresApiKey,
    resolveModel,
} from "./registry";
import type { AiProviderDescriptor } from "./registry";

describe("createProviderRegistry", () => {
    it("exposes ids in declaration order and looks descriptors up", () => {
        const registry = createProviderRegistry(BUILTIN_PROVIDERS);
        expect(registry.ids).toEqual(["anthropic", "openai", "gemini"]);
        expect(registry.get("openai").defaultModel).toBe(DEFAULT_MODELS.openai);
        expect(registry.has("gemini")).toBe(true);
        expect(registry.has("mistral")).toBe(false);
        expect(registry.find("mistral")).toBeUndefined();
    });

    it("throws on an unknown id lookup and on duplicate ids", () => {
        const registry = createProviderRegistry(BUILTIN_PROVIDERS);
        expect(() => registry.get("nope" as never)).toThrow(/nope/);
        expect(() =>
            createProviderRegistry([...BUILTIN_PROVIDERS, BUILTIN_PROVIDERS[0]]),
        ).toThrow(/duplicate/i);
        expect(() => createProviderRegistry([])).toThrow(/at least one/i);
    });

    it("accepts a bibliogon-shaped six-provider set incl. custom base URLs and keyless providers", () => {
        const custom: AiProviderDescriptor[] = [
            ...BUILTIN_PROVIDERS,
            {
                id: "mistral",
                label: "Mistral",
                keyFormat: { minLength: 20 },
                defaultModel: "mistral-small-latest",
            },
            {
                id: "lmstudio",
                label: "LM Studio",
                keyFormat: { minLength: 0 },
                defaultModel: "local-model",
                baseUrl: "http://localhost:1234/v1",
                requiresApiKey: false,
                desktopOnly: true,
            },
            {
                id: "custom",
                label: "Custom (OpenAI-compatible)",
                keyFormat: { minLength: 0 },
                defaultModel: "",
                requiresApiKey: false,
            },
        ];
        const registry = createProviderRegistry(custom);
        expect(registry.ids).toHaveLength(6);
        expect(registry.get("lmstudio").baseUrl).toBe("http://localhost:1234/v1");
        expect(providerRequiresApiKey(registry.get("lmstudio"))).toBe(false);
        expect(providerRequiresApiKey(registry.get("anthropic"))).toBe(true);
    });
});

describe("resolveModel", () => {
    const anthropic = BUILTIN_PROVIDERS[0];

    it("prefers a non-empty override, trimmed", () => {
        expect(resolveModel(anthropic, "  my-model  ")).toBe("my-model");
    });

    it("falls back to the descriptor default for null / empty / whitespace", () => {
        expect(resolveModel(anthropic, null)).toBe(anthropic.defaultModel);
        expect(resolveModel(anthropic, "")).toBe(anthropic.defaultModel);
        expect(resolveModel(anthropic, "   ")).toBe(anthropic.defaultModel);
    });
});
