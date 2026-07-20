import { afterEach, describe, expect, it, vi } from "vitest";

import { AiProviderError } from "./errors";
import { aiCompleteWithMeta, aiStream } from "./chat";
import type { ChatMessage } from "./types";

const MESSAGES: ChatMessage[] = [
    { role: "system", content: "You are terse." },
    { role: "user", content: "Hi" },
];

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function sseResponse(frames: string[]): Response {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            for (const frame of frames) {
                controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
            }
            controller.close();
        },
    });
    return new Response(stream, { status: 200 });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("aiCompleteWithMeta", () => {
    it("anthropic: hoists system to the top-level field and returns text + responseId", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, {
                id: "msg_1",
                content: [{ type: "text", text: "Hello" }],
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const result = await aiCompleteWithMeta({
            provider: "anthropic",
            model: "claude-x",
            apiKey: "sk-ant-key",
            messages: MESSAGES,
        });
        expect(result).toEqual({ text: "Hello", responseId: "msg_1" });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(init.headers["x-api-key"]).toBe("sk-ant-key");
        expect(init.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
        const body = JSON.parse(init.body);
        expect(body.system).toBe("You are terse.");
        expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    });

    it("openai: bearer auth, passes messages through", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, {
                id: "chatcmpl-1",
                choices: [{ message: { content: "Hey" } }],
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const result = await aiCompleteWithMeta({
            provider: "openai",
            model: "gpt-4o-mini",
            apiKey: "sk-abc",
            messages: MESSAGES,
        });
        expect(result.text).toBe("Hey");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://api.openai.com/v1/chat/completions");
        expect(init.headers.Authorization).toBe("Bearer sk-abc");
    });

    it("gemini: folds system into the first user part and maps assistant to model", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, {
                responseId: "r1",
                candidates: [{ content: { parts: [{ text: "Hallo" }] } }],
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const result = await aiCompleteWithMeta({
            provider: "gemini",
            model: "gemini-2.0-flash",
            apiKey: "AIza-key",
            messages: [...MESSAGES, { role: "assistant", content: "prior" }],
        });
        expect(result).toEqual({ text: "Hallo", responseId: "r1" });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain(":generateContent?key=AIza-key");
        const body = JSON.parse(init.body);
        expect(body.contents[0].parts[0].text).toBe("You are terse.\n\nHi");
        expect(body.contents[1].role).toBe("model");
    });

    it("maps provider errors to AiProviderError with status + provider tag", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "bad key" } })),
        );
        const call = aiCompleteWithMeta({
            provider: "anthropic",
            model: "m",
            apiKey: "k",
            messages: MESSAGES,
        });
        await expect(call).rejects.toBeInstanceOf(AiProviderError);
        await call.catch((err: AiProviderError) => {
            expect(err.status).toBe(401);
            expect(err.provider).toBe("anthropic");
            expect(err.message).toContain("bad key");
        });
    });

    it("throws 502 when the provider returns no text content", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonResponse(200, { choices: [] })),
        );
        const call = aiCompleteWithMeta({
            provider: "openai",
            model: "m",
            apiKey: "k",
            messages: MESSAGES,
        });
        await expect(call).rejects.toBeInstanceOf(AiProviderError);
        await call.catch((err: AiProviderError) => expect(err.status).toBe(502));
    });
});

describe("aiStream", () => {
    it("anthropic: emits content_block_delta text chunks", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                sseResponse([
                    JSON.stringify({ type: "message_start" }),
                    JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "He" } }),
                    JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "y" } }),
                ]),
            ),
        );
        const chunks: string[] = [];
        await aiStream({
            provider: "anthropic",
            model: "m",
            apiKey: "k",
            messages: MESSAGES,
            onChunk: (delta) => chunks.push(delta),
        });
        expect(chunks.join("")).toBe("Hey");
    });

    it("openai: stops at the [DONE] sentinel and collects deltas", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                sseResponse([
                    JSON.stringify({ choices: [{ delta: { content: "Ha" } }] }),
                    JSON.stringify({ choices: [{ delta: { content: "llo" } }] }),
                    "[DONE]",
                ]),
            ),
        );
        const chunks: string[] = [];
        await aiStream({
            provider: "openai",
            model: "m",
            apiKey: "k",
            messages: MESSAGES,
            onChunk: (delta) => chunks.push(delta),
        });
        expect(chunks.join("")).toBe("Hallo");
    });

    it("gemini: uses alt=sse and reads candidate parts", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            sseResponse([
                JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hi" }] } }] }),
            ]),
        );
        vi.stubGlobal("fetch", fetchMock);
        const chunks: string[] = [];
        await aiStream({
            provider: "gemini",
            model: "m",
            apiKey: "k",
            messages: MESSAGES,
            onChunk: (delta) => chunks.push(delta),
        });
        expect(chunks.join("")).toBe("Hi");
        expect(String(fetchMock.mock.calls[0][0])).toContain(":streamGenerateContent?alt=sse");
    });

    it("surfaces stream setup failures as AiProviderError", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
        );
        await expect(
            aiStream({
                provider: "openai",
                model: "m",
                apiKey: "k",
                messages: MESSAGES,
                onChunk: () => {},
            }),
        ).rejects.toBeInstanceOf(AiProviderError);
    });
});
