/**
 * Client-side API-key FORMAT validation (instant feedback).
 *
 * Catches the two cheap-to-detect mistakes before a key is ever saved or
 * test-called: a typo'd / truncated key, and a key pasted into the wrong
 * provider's field (an OpenAI ``sk-...`` into a Gemini row). This is a shape
 * check only — it never proves the key works; a live test call does that.
 *
 * The rules are deliberately loose lower bounds — providers lengthen their
 * keys and change their prefixes over time, so the check gates on a
 * conservative minimum length and only requires a positive prefix where the
 * provider keeps it stable. We reject on inner whitespace ONLY and
 * deliberately do NOT use a positive character allowlist: providers change
 * their key alphabets over time, and a positive allowlist silently rejects
 * valid keys.
 */

import type { KeyFormatRule } from "./registry";

/** A real API key never contains whitespace; an internal space / tab /
 *  newline is the tell-tale of a corrupted copy-paste. */
const KEY_WHITESPACE = /\s/;

/**
 * True when ``key`` has the right shape for the provider's
 * {@link KeyFormatRule}. Outer whitespace is trimmed first (a trailing
 * newline from a copy-paste is common and harmless). An empty string is NOT
 * valid — callers treat empty as "nothing entered yet" and show no error.
 */
export function isValidApiKeyFormat(rule: KeyFormatRule, key: string): boolean {
    const trimmed = key.trim();
    if (trimmed.length === 0) return false;
    if (trimmed.length < rule.minLength) return false;
    if (KEY_WHITESPACE.test(trimmed)) return false;
    if (rule.prefix !== undefined && !trimmed.startsWith(rule.prefix)) return false;
    if (rule.rejectPrefixes?.some((bad) => trimmed.startsWith(bad))) return false;
    return true;
}
