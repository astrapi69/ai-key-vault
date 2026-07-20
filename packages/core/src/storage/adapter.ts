/**
 * AiKeyStoreAdapter — the storage seam of the kit.
 *
 * The package NEVER touches IndexedDB, localStorage or a backend itself.
 * A consuming app implements this interface over its own persistence
 * (adaptive-learner: one thin adapter over its dual API/Dexie storage;
 * other apps: whatever they use) and hands it to the vault io functions and
 * the UI layer.
 *
 * Optional methods are CAPABILITIES: an adapter that cannot live-test keys
 * or keep last-known-good backups simply omits them and reports so via
 * ``capabilities`` — the UI renders those affordances only when present.
 */

/** Where a provider's key is sourced from. ``env`` and ``secrets_file`` are
 *  externally managed (the UI cannot edit them). */
export type KeySource = "env" | "secrets_file" | "settings" | "none";

/** Outcome classification of a live API-key test call. */
export type ApiKeyTestKind =
    | "ok"
    | "invalid"
    | "rate_limit"
    | "network"
    | "error"
    | "no_key";

export interface ApiKeyTestResult {
    success: boolean;
    kind: ApiKeyTestKind;
}

/** Last-known-good key backup metadata. */
export interface ApiKeyBackupInfo {
    has: boolean;
    testedAt: string | null;
}

/**
 * A read-model of the user's AI settings. Keys themselves are NEVER part of
 * the snapshot — only presence, source, masked preview and overrides.
 */
export interface AiSettingsSnapshot<P extends string = string> {
    activeProvider: P | null;
    hasKey: Record<P, boolean>;
    keySource: Record<P, KeySource>;
    keyPreview: Partial<Record<P, string | null>>;
    modelOverride: Partial<Record<P, string | null>>;
    /** Per-provider endpoint override (OpenAI-compatible / self-hosted
     *  providers, e.g. LM Studio or a custom server). Optional — apps
     *  without the concept simply omit it. */
    baseUrlOverride?: Partial<Record<P, string | null>>;
}

/** What an adapter can do beyond the mandatory surface. */
export interface AiKeyStoreCapabilities {
    /** True when stored keys are readable client-side (so an encrypted
     *  export is possible). False e.g. for a server that keeps keys
     *  encrypted at rest and never returns plaintext. */
    clientReadableKeys: boolean;
    /** True when the last-known-good backup methods are implemented. */
    keyBackup: boolean;
    /** True when ``testApiKey`` is implemented. */
    liveTest: boolean;
}

/**
 * The storage adapter a consuming app implements. ``P`` is the app's
 * provider-id union (or plain ``string`` for an open set).
 *
 * A patch value of ``null`` inside ``modelOverride`` / ``baseUrlOverride``
 * means "clear the override" — the adapter maps that onto its storage's own
 * clearing convention.
 */
export interface AiKeyStoreAdapter<P extends string = string> {
    readonly capabilities: AiKeyStoreCapabilities;

    getSettings(userId: string): Promise<AiSettingsSnapshot<P>>;
    patchSettings(
        userId: string,
        patch: Partial<
            Pick<AiSettingsSnapshot<P>, "activeProvider" | "modelOverride" | "baseUrlOverride">
        >,
    ): Promise<AiSettingsSnapshot<P>>;
    setApiKey(userId: string, provider: P, key: string): Promise<AiSettingsSnapshot<P>>;
    deleteApiKey(userId: string, provider: P): Promise<AiSettingsSnapshot<P>>;
    /** Plaintext keys for the encrypted export. Returns ``{}`` when
     *  ``capabilities.clientReadableKeys`` is false. */
    exportApiKeys(userId: string): Promise<Partial<Record<P, string>>>;

    testApiKey?(
        userId: string,
        provider: P,
        draftKey?: string,
    ): Promise<ApiKeyTestResult>;
    backupApiKey?(userId: string, provider: P, key: string): Promise<void>;
    getApiKeyBackup?(userId: string, provider: P): Promise<ApiKeyBackupInfo>;
    restoreApiKeyBackup?(userId: string, provider: P): Promise<AiSettingsSnapshot<P>>;
}
