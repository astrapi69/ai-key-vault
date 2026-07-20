import { afterEach, describe, expect, it, vi } from "vitest";

import { AiProviderError } from "./errors";
import {
    fetchAnthropicModels,
    fetchAvailableModels,
    fetchGeminiModels,
    fetchOpenAiModels,
} from "./model-discovery";

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetchAnthropicModels", () => {
    it("returns [] without a key and maps entries with the fixed context window", async () => {
        expect(await fetchAnthropicModels("")).toEqual([]);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse(200, {
                    data: [{ id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4" }],
                }),
            ),
        );
        const models = await fetchAnthropicModels("sk-ant-key");
        expect(models).toEqual([
            {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                context_window: 200000,
                description: null,
            },
        ]);
    });

    it("throws an invalid-key AiProviderError on 401", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
        await expect(fetchAnthropicModels("bad")).rejects.toBeInstanceOf(AiProviderError);
    });
});

describe("fetchOpenAiModels", () => {
    it("filters to chat models and humanizes names", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse(200, {
                    data: [
                        { id: "gpt-4o-mini" },
                        { id: "text-embedding-3-small" },
                        { id: "whisper-1" },
                        { id: "o3-mini" },
                    ],
                }),
            ),
        );
        const models = await fetchOpenAiModels("sk-abc");
        expect(models.map((m) => m.id).sort()).toEqual(["gpt-4o-mini", "o3-mini"]);
        expect(models.find((m) => m.id === "gpt-4o-mini")?.name).toBe("GPT-4o mini");
    });
});

describe("fetchGeminiModels", () => {
    it("keeps only generateContent models and strips the models/ prefix", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse(200, {
                    models: [
                        {
                            name: "models/gemini-2.0-flash",
                            displayName: "Gemini 2.0 Flash",
                            supportedGenerationMethods: ["generateContent"],
                            inputTokenLimit: 1048576,
                        },
                        {
                            name: "models/text-embedding-004",
                            supportedGenerationMethods: ["embedContent"],
                        },
                    ],
                }),
            ),
        );
        const models = await fetchGeminiModels("AIza-key");
        expect(models).toEqual([
            {
                id: "gemini-2.0-flash",
                name: "Gemini 2.0 Flash",
                context_window: 1048576,
                description: null,
            },
        ]);
    });
});

describe("fetchAvailableModels", () => {
    it("dispatches by provider id and rejects unknown providers", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse(200, { data: [] })),
        );
        expect(await fetchAvailableModels("openai", "sk-abc")).toEqual([]);
        await expect(
            fetchAvailableModels("mistral" as never, "key"),
        ).rejects.toBeInstanceOf(AiProviderError);
    });
});
