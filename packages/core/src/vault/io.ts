/**
 * vault io — orchestrates the passphrase-encrypted key export/import: read
 * keys + provider settings through an {@link AiKeyStoreAdapter}, encrypt to
 * an envelope, and on import decrypt and write back through the SAME adapter
 * sinks manual key entry uses (``setApiKey`` + ``patchSettings``).
 *
 * The adapter is injected (never imported) so this stays pure and
 * unit-testable with an in-memory fake. ``VaultDecryptError`` propagates for
 * a wrong passphrase / corrupt / foreign file; nothing is written until the
 * payload has fully decrypted AND validated as a key vault, so a failed
 * decrypt never produces a partial import.
 */

import {
    VaultDecryptError,
    decryptFromVault,
    encryptToVault,
} from "@astrapi69/passphrase-vault";

import type { AiKeyStoreAdapter } from "../storage/adapter";
import {
    buildKeyVaultPayload,
    hasExportableKey,
    normalizeKeyVaultPayload,
} from "./payload";

/** Options shared by export + import. */
export interface KeyVaultIoOptions<P extends string = string> {
    /** The provider ids the app knows (usually ``registry.ids``). */
    providerIds: readonly P[];
    /** Envelope format string; defaults to the passphrase-vault default. */
    format?: string;
}

/**
 * Build the encrypted envelope for the user's keys + provider settings, or
 * ``null`` when there is no exportable key (the export entry should be
 * disabled).
 */
export async function buildEncryptedKeyVault<P extends string>(
    adapter: AiKeyStoreAdapter<P>,
    userId: string,
    passphrase: string,
    options: KeyVaultIoOptions<P>,
): Promise<string | null> {
    const raw = await adapter.exportApiKeys(userId);
    if (!hasExportableKey(options.providerIds, raw)) return null;
    const snapshot = await adapter.getSettings(userId);
    const payload = buildKeyVaultPayload(options.providerIds, raw, {
        activeProvider: snapshot.activeProvider,
        modelOverride: snapshot.modelOverride,
    });
    return encryptToVault(payload, passphrase, { format: options.format });
}

/** Result of a successful import: which providers got a key. */
export interface KeyVaultImportResult<P extends string = string> {
    providers: P[];
}

/**
 * Decrypt a vault file and write its keys + provider settings through the
 * adapter. Throws {@link VaultDecryptError} for a wrong passphrase /
 * corrupt / foreign file BEFORE any write (no partial import). Accepts both
 * the generic payload shape and the legacy adaptive-learner shape.
 */
export async function importEncryptedKeyVault<P extends string>(
    adapter: AiKeyStoreAdapter<P>,
    userId: string,
    fileText: string,
    passphrase: string,
    options: KeyVaultIoOptions<P>,
): Promise<KeyVaultImportResult<P>> {
    const decrypted = await decryptFromVault<unknown>(fileText, passphrase, {
        format: options.format,
    });
    const payload = normalizeKeyVaultPayload(options.providerIds, decrypted);
    if (payload === null) {
        // A valid envelope that decrypted to the wrong shape (e.g. a foreign
        // file) — reject the same friendly way, never a partial write.
        throw new VaultDecryptError();
    }

    const written: P[] = [];
    for (const provider of options.providerIds) {
        const key = payload.keys[provider];
        if (key) {
            await adapter.setApiKey(userId, provider, key);
            written.push(provider);
        }
    }
    await adapter.patchSettings(userId, {
        ...(payload.providerSettings.activeProvider
            ? { activeProvider: payload.providerSettings.activeProvider }
            : {}),
        modelOverride: payload.providerSettings.modelOverride,
    });
    return { providers: written };
}
