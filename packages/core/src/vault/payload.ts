/**
 * key-vault payload — the value moved by the passphrase-encrypted key
 * export: the AI provider keys plus the provider settings. Pure shaping +
 * validation helpers; the encryption lives in ``@astrapi69/passphrase-vault``
 * and the storage reads/writes in ``vault/io.ts``.
 *
 * The payload is provider-GENERIC (``Record<ProviderId, ...>``). The legacy
 * adaptive-learner payload (fixed snake_case fields
 * ``active_provider`` / ``model_override_<id>``) is still accepted on read
 * via {@link normalizeKeyVaultPayload}, so pre-extraction ``.alk`` files
 * keep importing.
 */

/** Dedicated file extension for the encrypted key vault. */
export const KEY_VAULT_EXTENSION = ".alk";

/** The provider settings carried alongside the keys. */
export interface KeyVaultProviderSettings<P extends string = string> {
    activeProvider: P | null;
    /** Per-provider model override; ``null`` = no override. */
    modelOverride: Partial<Record<P, string | null>>;
}

/** Decrypted vault payload. Only providers that have a key are present in
 *  ``keys``; ``modelOverride`` carries an entry per known provider. */
export interface KeyVaultPayload<P extends string = string> {
    keys: Partial<Record<P, string>>;
    providerSettings: KeyVaultProviderSettings<P>;
}

/** Raw plaintext keys as read from storage. */
export type RawApiKeys<P extends string = string> = Partial<Record<P, string>>;

/** Drop empty / whitespace-only keys and keys of unknown providers so the
 *  vault only carries usable ones. */
export function presentKeys<P extends string>(
    providerIds: readonly P[],
    raw: RawApiKeys<P>,
): RawApiKeys<P> {
    const out: RawApiKeys<P> = {};
    for (const provider of providerIds) {
        const key = raw[provider];
        if (typeof key === "string" && key.trim().length > 0) {
            out[provider] = key;
        }
    }
    return out;
}

/** True when at least one provider has an exportable key. Drives the
 *  export-entry gate (disabled when false). */
export function hasExportableKey<P extends string>(
    providerIds: readonly P[],
    raw: RawApiKeys<P>,
): boolean {
    return Object.keys(presentKeys(providerIds, raw)).length > 0;
}

/** Build the vault payload from the raw keys + the user's settings. The
 *  ``modelOverride`` map is completed to one entry per provider id
 *  (``null`` when no override), so the import side can clear stale
 *  overrides deterministically. */
export function buildKeyVaultPayload<P extends string>(
    providerIds: readonly P[],
    raw: RawApiKeys<P>,
    settings: {
        activeProvider: P | null;
        modelOverride: Partial<Record<P, string | null>>;
    },
): KeyVaultPayload<P> {
    const modelOverride: Partial<Record<P, string | null>> = {};
    for (const provider of providerIds) {
        modelOverride[provider] = settings.modelOverride[provider] ?? null;
    }
    return {
        keys: presentKeys(providerIds, raw),
        providerSettings: {
            activeProvider: settings.activeProvider ?? null,
            modelOverride,
        },
    };
}

const LEGACY_MODEL_OVERRIDE_PREFIX = "model_override_";

/**
 * Validate + normalize a decrypted object into a {@link KeyVaultPayload},
 * or return ``null`` when it is not one (e.g. a different app's file — the
 * caller rejects it the same friendly way as a bad passphrase).
 *
 * Accepts BOTH payload shapes:
 *   - the generic shape (``providerSettings.activeProvider`` +
 *     ``providerSettings.modelOverride`` map), and
 *   - the legacy adaptive-learner shape (``active_provider`` +
 *     ``model_override_<id>`` snake_case fields).
 *
 * An unknown provider id in ``keys`` rejects the payload (a corrupted or
 * foreign file); an unknown ``activeProvider`` is coerced to ``null``.
 */
export function normalizeKeyVaultPayload<P extends string>(
    providerIds: readonly P[],
    value: unknown,
): KeyVaultPayload<P> | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (!v.keys || typeof v.keys !== "object") return null;
    if (!v.providerSettings || typeof v.providerSettings !== "object") {
        return null;
    }
    const known = new Set<string>(providerIds);
    const rawKeys = v.keys as Record<string, unknown>;
    const keys: RawApiKeys<P> = {};
    for (const [provider, key] of Object.entries(rawKeys)) {
        if (!known.has(provider)) return null;
        if (typeof key !== "string") return null;
        keys[provider as P] = key;
    }

    const rawSettings = v.providerSettings as Record<string, unknown>;
    const activeRaw =
        typeof rawSettings.activeProvider === "string"
            ? rawSettings.activeProvider
            : typeof rawSettings.active_provider === "string"
              ? rawSettings.active_provider
              : null;
    const activeProvider = activeRaw !== null && known.has(activeRaw) ? (activeRaw as P) : null;

    const modelOverride: Partial<Record<P, string | null>> = {};
    for (const provider of providerIds) modelOverride[provider] = null;
    if (rawSettings.modelOverride && typeof rawSettings.modelOverride === "object") {
        for (const [provider, override] of Object.entries(
            rawSettings.modelOverride as Record<string, unknown>,
        )) {
            if (known.has(provider) && (typeof override === "string" || override === null)) {
                modelOverride[provider as P] = override;
            }
        }
    }
    for (const [field, override] of Object.entries(rawSettings)) {
        if (!field.startsWith(LEGACY_MODEL_OVERRIDE_PREFIX)) continue;
        const provider = field.slice(LEGACY_MODEL_OVERRIDE_PREFIX.length);
        if (known.has(provider) && (typeof override === "string" || override === null)) {
            modelOverride[provider as P] = override;
        }
    }

    return {
        keys: presentKeys(providerIds, keys),
        providerSettings: { activeProvider, modelOverride },
    };
}
