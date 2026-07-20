/**
 * Translate — the i18n injection seam of the kit.
 *
 * The package depends on no i18n framework. Anything user-facing takes a
 * ``t(key, fallback)`` function; consumers pass their own i18n hook's
 * translate function, and the English fallback renders when a key is
 * missing from the consumer's catalogs.
 */
export type Translate = (key: string, fallback?: string) => string;
