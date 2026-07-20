/**
 * Shared client-facing types: chat messages, completions, model entries and
 * the pluggable per-provider client contract used by
 * {@link AiProviderDescriptor.client} for providers the built-in
 * anthropic/openai/gemini clients do not cover.
 */

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/** Assistant text plus the provider's response id, when available. */
export interface AiCompletion {
    text: string;
    /** Provider response id (OpenAI ``chatcmpl-…`` / Anthropic ``msg_…`` /
     *  Gemini ``responseId``), or undefined if the provider omitted it. */
    responseId?: string;
}

/** One entry of a provider's model list. */
export interface ModelInfo {
    id: string;
    name: string;
    context_window: number | null;
    description: string | null;
}

/** Arguments of a single provider call. The API key is ALWAYS a parameter —
 *  clients never read storage themselves. */
export interface ProviderCallOptions {
    model: string;
    apiKey: string;
    messages: ChatMessage[];
    /** Hard cap on the assistant's reply length. Defaults to 1024. */
    maxTokens?: number;
    /** Optional AbortSignal — aborts the underlying ``fetch``. */
    signal?: AbortSignal;
}

/**
 * Pluggable client for a provider the built-in trio does not cover
 * (e.g. a future mistral or an OpenAI-compatible local server). Attached to
 * a descriptor via {@link AiProviderDescriptor.client}.
 */
export interface AiProviderClient {
    complete(opts: ProviderCallOptions): Promise<AiCompletion>;
    stream?(
        opts: ProviderCallOptions & { onChunk: (delta: string) => void },
    ): Promise<void>;
    listModels?(apiKey: string): Promise<ModelInfo[]>;
}
