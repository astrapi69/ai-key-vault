/**
 * Provider registry — providers are DATA (descriptor objects), not a
 * hardcoded union type. Extracted from adaptive-learner, generalized after
 * validating the shape against bibliogon's six-provider needs (anthropic,
 * openai, gemini/google, mistral, LM Studio, custom OpenAI-compatible with a
 * user base URL): descriptors carry an optional ``baseUrl``, an optional
 * ``requiresApiKey`` (local providers have no key), and an optional custom
 * ``client`` for protocols the built-in trio does not cover.
 */

import type { AiProviderClient } from "../clients/types";

/** Shape rules for a provider's API key (format check only — never proves
 *  the key works; a live test call does that). */
export interface KeyFormatRule {
    /** Required leading prefix; omit when the provider has no reliable one. */
    prefix?: string;
    minLength: number;
    /** Prefixes that disqualify the key — catches a wrong-provider paste
     *  when there is no positive prefix to match. */
    rejectPrefixes?: readonly string[];
}

/**
 * Everything the kit needs to know about one AI provider.
 *
 * @example
 * const lmstudio: AiProviderDescriptor = {
 *     id: "lmstudio",
 *     label: "LM Studio",
 *     keyFormat: { minLength: 0 },
 *     defaultModel: "local-model",
 *     baseUrl: "http://localhost:1234/v1",
 *     requiresApiKey: false,
 *     desktopOnly: true,
 * };
 */
export interface AiProviderDescriptor<P extends string = string> {
    id: P;
    label: string;
    keyFormat: KeyFormatRule;
    /** Short English fallback hint for the key input (i18n key fallback). */
    keyFormatHint?: string;
    defaultModel: string;
    /** Curated model families (id prefixes), most-recommended first. */
    recommendedModels?: readonly string[];
    /** Default endpoint base for OpenAI-compatible / self-hosted providers. */
    baseUrl?: string;
    /** False for local providers (LM Studio, custom) that need no key.
     *  Defaults to true. */
    requiresApiKey?: boolean;
    /** Only usable from the desktop / server app (not browser-direct). */
    desktopOnly?: boolean;
    /** Cannot be called browser-direct (CORS). */
    corsBlocked?: boolean;
    /** Custom client for providers the built-in trio does not cover. */
    client?: AiProviderClient;
}

/** Lookup surface over an ordered set of provider descriptors. */
export interface ProviderRegistry<P extends string = string> {
    readonly ids: readonly P[];
    all(): readonly AiProviderDescriptor<P>[];
    /** Throws for an unknown id — use {@link find} for a soft lookup. */
    get(id: P): AiProviderDescriptor<P>;
    find(id: string): AiProviderDescriptor<P> | undefined;
    has(id: string): boolean;
}

/**
 * Build a registry from descriptor objects. Order is preserved (it drives
 * UI ordering). Throws on an empty set or duplicate ids.
 */
export function createProviderRegistry<P extends string>(
    descriptors: readonly AiProviderDescriptor<P>[],
): ProviderRegistry<P> {
    if (descriptors.length === 0) {
        throw new Error("createProviderRegistry needs at least one descriptor");
    }
    const byId = new Map<string, AiProviderDescriptor<P>>();
    for (const descriptor of descriptors) {
        if (byId.has(descriptor.id)) {
            throw new Error(`Duplicate provider id: ${descriptor.id}`);
        }
        byId.set(descriptor.id, descriptor);
    }
    return {
        ids: descriptors.map((d) => d.id),
        all: () => descriptors,
        get: (id) => {
            const descriptor = byId.get(id);
            if (!descriptor) throw new Error(`Unknown provider id: ${id}`);
            return descriptor;
        },
        find: (id) => byId.get(id),
        has: (id) => byId.has(id),
    };
}

/** Whether the provider needs an API key (defaults to true). */
export function providerRequiresApiKey(
    descriptor: AiProviderDescriptor,
): boolean {
    return descriptor.requiresApiKey ?? true;
}

/**
 * Resolve the effective model for a provider: a non-empty override wins over
 * the descriptor default.
 */
export function resolveModel(
    descriptor: AiProviderDescriptor,
    override: string | null | undefined,
): string {
    if (typeof override === "string" && override.trim().length > 0) {
        return override.trim();
    }
    return descriptor.defaultModel;
}

/** The ids covered by the built-in browser-direct clients. */
export type BuiltinProviderId = "anthropic" | "openai" | "gemini";

/**
 * The three built-in providers, carrying the format rules, defaults and
 * recommended families extracted from adaptive-learner.
 */
export const BUILTIN_PROVIDERS: readonly AiProviderDescriptor<BuiltinProviderId>[] = [
    {
        id: "anthropic",
        label: "Anthropic Claude",
        keyFormat: { prefix: "sk-ant-", minLength: 40 },
        keyFormatHint: "Starts with sk-ant-",
        defaultModel: "claude-haiku-4-5-20251001",
        recommendedModels: ["claude-sonnet-4", "claude-opus-4", "claude-haiku-4-5"],
    },
    {
        id: "openai",
        label: "OpenAI",
        keyFormat: { prefix: "sk-", minLength: 20 },
        keyFormatHint: "Starts with sk-",
        defaultModel: "gpt-4o-mini",
        recommendedModels: ["gpt-4o-mini", "gpt-4o", "o3-mini"],
    },
    {
        id: "gemini",
        label: "Google Gemini",
        keyFormat: { minLength: 20, rejectPrefixes: ["sk-"] },
        keyFormatHint: "At least 20 characters",
        defaultModel: "gemini-2.0-flash",
        recommendedModels: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
    },
];

/** Default per-provider model of the built-in trio, keyed by id. */
export const DEFAULT_MODELS: Record<BuiltinProviderId, string> = Object.fromEntries(
    BUILTIN_PROVIDERS.map((d) => [d.id, d.defaultModel]),
) as Record<BuiltinProviderId, string>;

/** Ready-made registry over the built-in trio. */
export const BUILTIN_REGISTRY: ProviderRegistry<BuiltinProviderId> =
    createProviderRegistry(BUILTIN_PROVIDERS);

/**
 * Perplexity - an OpenAI-compatible provider, offered as a ready descriptor
 * apps can spread into their registry (`createProviderRegistry([...BUILTIN_PROVIDERS, PERPLEXITY_PROVIDER])`).
 *
 * Deliberately NOT part of {@link BUILTIN_PROVIDERS}: that trio is the set the
 * built-in BROWSER-DIRECT clients (`clients/chat.ts`, model discovery) cover,
 * and Perplexity offers no browser-direct CORS opt-in. It is therefore marked
 * `corsBlocked` and must be routed through a backend proxy; a host wires it
 * via its own OpenAI-compatible request path (base URL below).
 */
export const PERPLEXITY_PROVIDER: AiProviderDescriptor<"perplexity"> = {
    id: "perplexity",
    label: "Perplexity",
    keyFormat: { prefix: "pplx-", minLength: 20 },
    keyFormatHint: "Starts with pplx-",
    defaultModel: "sonar-pro",
    recommendedModels: ["sonar", "sonar-pro", "sonar-reasoning"],
    baseUrl: "https://api.perplexity.ai",
    requiresApiKey: true,
    corsBlocked: true,
};
