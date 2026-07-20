/**
 * Browser-direct AI provider chat calls for the built-in trio
 * (anthropic / openai / gemini).
 *
 * Each provider has its own HTTP shape; ``aiComplete`` dispatches to the
 * right one based on the provider id. A browser-direct (no-backend) app
 * uses these clients straight from the user's browser.
 *
 * Cross-origin notes:
 *   - **Anthropic**: requires ``anthropic-dangerous-direct-browser-access: true``.
 *     This is Anthropic's explicit opt-in for browser callers and bypasses
 *     the CORS preflight rejection that the default setting enforces.
 *   - **OpenAI**: CORS is open by default; just include the
 *     ``Authorization: Bearer ${key}`` header.
 *   - **Gemini**: the v1beta REST endpoint accepts the API key as a query
 *     parameter (``?key=...``), no Authorization header. CORS is open.
 *
 * Errors are surfaced as {@link AiProviderError} (status + detail +
 * provider id) so consumers can map them onto their own error plumbing.
 * The API key is always a call parameter — this module never reads storage.
 */

import { AiProviderError } from "./errors";
import type { AiCompletion, ChatMessage } from "./types";
import type { BuiltinProviderId } from "../providers/registry";

export interface AiCompleteOptions {
    provider: BuiltinProviderId;
    model: string;
    apiKey: string;
    messages: ChatMessage[];
    /** Hard cap on the assistant's reply length. Defaults to 1024. */
    maxTokens?: number;
    /** Optional AbortSignal — aborts the underlying ``fetch``. */
    signal?: AbortSignal;
}

/**
 * Provider-agnostic entry point. Returns the assistant text on success;
 * throws {@link AiProviderError} on transport / auth / provider failure.
 */
export async function aiComplete(opts: AiCompleteOptions): Promise<string> {
    return (await aiCompleteWithMeta(opts)).text;
}

/**
 * Like {@link aiComplete} but also returns the provider response id.
 * Same error semantics.
 */
export async function aiCompleteWithMeta(
    opts: AiCompleteOptions,
): Promise<AiCompletion> {
    const maxTokens = opts.maxTokens ?? 1024;
    switch (opts.provider) {
        case "anthropic":
            return anthropicComplete(opts.model, opts.apiKey, opts.messages, maxTokens, opts.signal);
        case "openai":
            return openaiComplete(opts.model, opts.apiKey, opts.messages, maxTokens, opts.signal);
        case "gemini":
            return geminiComplete(opts.model, opts.apiKey, opts.messages, maxTokens, opts.signal);
    }
}

// ---- Anthropic --------------------------------------------------------

interface AnthropicResponse {
    id?: string;
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string; type?: string };
}

function anthropicBody(
    model: string,
    messages: ChatMessage[],
    maxTokens: number,
    stream: boolean,
): Record<string, unknown> {
    // Anthropic separates ``system`` from ``messages``. Pull the system
    // messages out and pass them as a top-level field.
    const systemMessages = messages.filter((m) => m.role === "system");
    const conv = messages.filter((m) => m.role !== "system");
    const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages: conv.map((m) => ({ role: m.role, content: m.content })),
    };
    if (stream) body.stream = true;
    if (systemMessages.length > 0) {
        body.system = systemMessages.map((m) => m.content).join("\n\n");
    }
    return body;
}

function anthropicHeaders(apiKey: string): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
    };
}

async function anthropicComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    signal?: AbortSignal,
): Promise<AiCompletion> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(apiKey),
        body: JSON.stringify(anthropicBody(model, messages, maxTokens, false)),
        signal,
    });
    const json = (await response.json().catch(() => ({}))) as AnthropicResponse;
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new AiProviderError(response.status, `Anthropic: ${detail}`, "anthropic");
    }
    const first = json.content?.find((c) => c.type === "text");
    if (!first?.text) {
        throw new AiProviderError(502, "Anthropic returned no text content", "anthropic");
    }
    return { text: first.text, responseId: json.id };
}

// ---- OpenAI -----------------------------------------------------------

interface OpenAiResponse {
    id?: string;
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string; type?: string };
}

async function openaiComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    signal?: AbortSignal,
): Promise<AiCompletion> {
    const body = {
        model,
        max_tokens: maxTokens,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
    });
    const json = (await response.json().catch(() => ({}))) as OpenAiResponse;
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new AiProviderError(response.status, `OpenAI: ${detail}`, "openai");
    }
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.length === 0) {
        throw new AiProviderError(502, "OpenAI returned no text content", "openai");
    }
    return { text, responseId: json.id };
}

// ---- Gemini -----------------------------------------------------------

interface GeminiResponse {
    responseId?: string;
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
    }>;
    error?: { message?: string };
}

/** Gemini has no separate system field; system messages are folded into the
 *  first user part. Roles map user -> "user", assistant -> "model". */
function geminiContents(messages: ChatMessage[]): Array<Record<string, unknown>> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const conv = messages.filter((m) => m.role !== "system");
    return conv.map((m, idx) => {
        const role = m.role === "assistant" ? "model" : "user";
        const prefix =
            idx === 0 && systemMessages.length > 0 && m.role === "user"
                ? `${systemMessages.map((s) => s.content).join("\n\n")}\n\n`
                : "";
        return { role, parts: [{ text: prefix + m.content }] };
    });
}

async function geminiComplete(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    signal?: AbortSignal,
): Promise<AiCompletion> {
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: geminiContents(messages),
            generationConfig: { maxOutputTokens: maxTokens },
        }),
        signal,
    });
    const json = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
        const detail = json.error?.message ?? `HTTP ${response.status}`;
        throw new AiProviderError(response.status, `Gemini: ${detail}`, "gemini");
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || text.length === 0) {
        throw new AiProviderError(502, "Gemini returned no text content", "gemini");
    }
    return { text, responseId: json.responseId };
}

// ---- Streaming dispatch ----------------------------------------------

export interface AiStreamOptions extends AiCompleteOptions {
    /** Called for every text delta as it arrives from the provider. */
    onChunk: (delta: string) => void;
}

/**
 * Browser-direct streaming variant of {@link aiComplete}.
 *
 * All three provider APIs expose a Server-Sent-Events-style streaming
 * response that emits text deltas as the model generates. The dispatcher
 * routes by provider and parses each provider's SSE shape into bare text
 * deltas the caller can append to a UI bubble.
 *
 * Resolves when the stream ends (provider closes the connection or sends
 * ``[DONE]`` for OpenAI). Rejects on transport / auth / parse failures,
 * surfaced as {@link AiProviderError}.
 */
export async function aiStream(opts: AiStreamOptions): Promise<void> {
    const maxTokens = opts.maxTokens ?? 1024;
    switch (opts.provider) {
        case "anthropic":
            return anthropicStream(opts.model, opts.apiKey, opts.messages, maxTokens, opts.onChunk, opts.signal);
        case "openai":
            return openaiStream(opts.model, opts.apiKey, opts.messages, maxTokens, opts.onChunk, opts.signal);
        case "gemini":
            return geminiStream(opts.model, opts.apiKey, opts.messages, maxTokens, opts.onChunk, opts.signal);
    }
}

/**
 * Read the SSE-style body of a fetch response line by line. Calls
 * ``onFrame`` for every blank-line-separated frame's ``data: ...`` content
 * (one or more lines joined). Returns when the stream closes.
 */
async function readEventStream(
    response: Response,
    onFrame: (data: string) => void,
): Promise<void> {
    if (!response.body) {
        throw new AiProviderError(502, "Provider returned empty body", "");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let separator = buffer.indexOf("\n\n");
            while (separator !== -1) {
                const frame = buffer.slice(0, separator);
                buffer = buffer.slice(separator + 2);
                // Concatenate every ``data:`` line in this frame. Strip the
                // optional single leading space per spec.
                const dataLines: string[] = [];
                for (const line of frame.split(/\r?\n/)) {
                    if (line.startsWith("data:")) {
                        const raw = line.slice(5);
                        dataLines.push(raw.startsWith(" ") ? raw.slice(1) : raw);
                    }
                }
                if (dataLines.length > 0) {
                    onFrame(dataLines.join("\n"));
                }
                separator = buffer.indexOf("\n\n");
            }
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {
            /* may already be released after abort */
        }
    }
}

async function throwStreamSetupError(
    response: Response,
    label: string,
    provider: string,
): Promise<never> {
    const txt = await response.text().catch(() => "");
    let detail = `HTTP ${response.status}`;
    try {
        const parsed = JSON.parse(txt) as { error?: { message?: string } };
        if (parsed?.error?.message) detail = parsed.error.message;
    } catch {
        /* not JSON */
    }
    throw new AiProviderError(response.status, `${label}: ${detail}`, provider);
}

async function anthropicStream(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    onChunk: (delta: string) => void,
    signal: AbortSignal | undefined,
): Promise<void> {
    // Same shape as anthropicComplete but ``stream: true`` flips the
    // response into SSE. Event types read: content_block_delta; everything
    // else (message_start, ping, ...) is ignored.
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders(apiKey),
        body: JSON.stringify(anthropicBody(model, messages, maxTokens, true)),
        signal,
    });
    if (!response.ok) {
        await throwStreamSetupError(response, "Anthropic", "anthropic");
    }
    await readEventStream(response, (data) => {
        try {
            const event = JSON.parse(data) as {
                type?: string;
                delta?: { type?: string; text?: string };
            };
            if (event.type === "content_block_delta") {
                const text = event.delta?.text;
                if (typeof text === "string" && text.length > 0) {
                    onChunk(text);
                }
            }
        } catch {
            /* non-JSON keepalive */
        }
    });
}

async function openaiStream(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    onChunk: (delta: string) => void,
    signal: AbortSignal | undefined,
): Promise<void> {
    // OpenAI's SSE stream uses ``data: [DONE]`` as the end-of-stream
    // sentinel. Each non-sentinel frame is a JSON object shaped
    // ``{choices: [{delta: {content?: string}}]}``.
    const body = {
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!response.ok) {
        await throwStreamSetupError(response, "OpenAI", "openai");
    }
    await readEventStream(response, (data) => {
        if (data === "[DONE]") return;
        try {
            const event = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string | null } }>;
            };
            const content = event.choices?.[0]?.delta?.content;
            if (typeof content === "string" && content.length > 0) {
                onChunk(content);
            }
        } catch {
            /* keepalive / non-JSON */
        }
    });
}

async function geminiStream(
    model: string,
    apiKey: string,
    messages: ChatMessage[],
    maxTokens: number,
    onChunk: (delta: string) => void,
    signal: AbortSignal | undefined,
): Promise<void> {
    // ``alt=sse`` switches Gemini's stream to the same data-line SSE wire
    // shape Anthropic + OpenAI use; ``readEventStream`` covers all three.
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:streamGenerateContent?alt=sse` +
        `&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: geminiContents(messages),
            generationConfig: { maxOutputTokens: maxTokens },
        }),
        signal,
    });
    if (!response.ok) {
        await throwStreamSetupError(response, "Gemini", "gemini");
    }
    await readEventStream(response, (data) => {
        try {
            const event = JSON.parse(data) as {
                candidates?: Array<{
                    content?: { parts?: Array<{ text?: string }> };
                }>;
            };
            const parts = event.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    const text = part?.text;
                    if (typeof text === "string" && text.length > 0) {
                        onChunk(text);
                    }
                }
            }
        } catch {
            /* keepalive / non-JSON */
        }
    });
}
