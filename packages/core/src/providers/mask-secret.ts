/**
 * Mask a secret (API key, token) down to a recognisable preview that
 * reveals only the first 4 and last 4 characters — enough for a user to
 * confirm *which* key is stored, never enough to leak it.
 *
 * @example
 * maskSecret("AIzaSyA-1234567f3k") // "AIza…7f3k"
 * maskSecret("short")              // "•••••"
 * maskSecret(null)                 // null
 */

const ELLIPSIS = "…";

/**
 * Return a masked preview of ``secret`` (first 4 + ellipsis + last 4), or
 * ``null`` when there is nothing to show.
 *
 * Short secrets (8 chars or fewer) cannot show a first-4/last-4 window
 * without overlapping, so they collapse to a row of bullet characters of
 * the same length — the user still learns a key exists, with zero
 * characters revealed.
 */
export function maskSecret(secret: string | null | undefined): string | null {
    if (secret == null) return null;
    const trimmed = secret.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length <= 8) {
        return "•".repeat(trimmed.length);
    }
    return `${trimmed.slice(0, 4)}${ELLIPSIS}${trimmed.slice(-4)}`;
}
