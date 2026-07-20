/**
 * Pure status classification for an AI provider's API key, shared by
 * provider-overview UIs.
 *
 * A provider is in exactly one of four states, derived from whether a key is
 * stored, where the key is sourced from, whether the app runs browser-direct,
 * and whether the provider can be reached from a browser:
 *
 *   - ``desktop_only`` — the provider cannot be called from the browser
 *     (CORS-blocked) so it is only usable with the desktop / server app.
 *     Takes precedence in a browser runtime regardless of key state.
 *   - ``external`` — a key is present but managed outside the app
 *     (environment variable or a secrets file); the UI cannot edit it.
 *   - ``active`` — an app-managed key is stored and usable.
 *   - ``empty`` — no key configured anywhere.
 */

import type { KeySource } from "../storage/adapter";

/** One of the four mutually-exclusive provider key states. */
export type ProviderKeyStatus = "active" | "empty" | "desktop_only" | "external";

export interface ProviderKeyStatusInput {
    /** Whether a key is configured for this provider. */
    hasKey: boolean;
    /** Where the key is sourced from. */
    source: KeySource;
    /** True when the app runs browser-direct (no backend to proxy calls). */
    browser: boolean;
    /** Whether the provider is CORS-blocked browser-direct
     *  (see {@link AiProviderDescriptor.corsBlocked}). */
    corsBlocked: boolean;
}

/**
 * Classify a provider's key state. See the module doc for the four states
 * and their precedence.
 */
export function providerKeyStatus({
    hasKey,
    source,
    browser,
    corsBlocked,
}: ProviderKeyStatusInput): ProviderKeyStatus {
    // A browser-unreachable provider is desktop-only in a browser runtime no
    // matter what key state it is in — using it there is impossible.
    if (browser && corsBlocked) return "desktop_only";
    if (!hasKey) return "empty";
    if (source === "env" || source === "secrets_file") return "external";
    return "active";
}
