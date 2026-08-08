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
    /**
     * Envelope format string stamped on EXPORT (defaults to the
     * passphrase-vault default). Import is format-AGNOSTIC: it decrypts with
     * whatever format the file itself declares, so a sibling app's vault opens
     * regardless of its label. See {@link importEncryptedKeyVault}.
     */
    format?: string;
    /**
     * Map a source app's provider ids onto this app's ids on IMPORT
     * (e.g. ``{ gemini: "google" }``), so a user can port keys between sibling
     * apps that name the same provider differently. Applied before the
     * known-id check; an id that is neither known nor aliased still rejects.
     */
    providerAliases?: Readonly<Record<string, string>>;
}

/** Read the plaintext ``format`` label an envelope declares, without
 *  decrypting. ``undefined`` when the text is not a JSON envelope. */
function readEnvelopeFormat(fileText: string): string | undefined {
    try {
        const env = JSON.parse(fileText) as { format?: unknown };
        return typeof env.format === "string" ? env.format : undefined;
    } catch {
        return undefined;
    }
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
 *
 * Import is format-AGNOSTIC by design so keys port between sibling apps: it
 * decrypts with the format the FILE declares, not the host app's own label.
 * The security boundary is the passphrase + the AES-GCM authentication tag,
 * not the plaintext format string; a wrong passphrase or a tampered file
 * still fails to decrypt. Pair with ``options.providerAliases`` when the two
 * apps name a provider differently (e.g. ``{ gemini: "google" }``).
 */
export async function importEncryptedKeyVault<P extends string>(
    adapter: AiKeyStoreAdapter<P>,
    userId: string,
    fileText: string,
    passphrase: string,
    options: KeyVaultIoOptions<P>,
): Promise<KeyVaultImportResult<P>> {
    const decrypted = await decryptFromVault<unknown>(fileText, passphrase, {
        // Decrypt against the file's own declared format (falling back to the
        // host label for a non-JSON input, which then fails to decrypt).
        format: readEnvelopeFormat(fileText) ?? options.format,
    });
    const payload = normalizeKeyVaultPayload(options.providerIds, decrypted, {
        aliases: options.providerAliases,
    });
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
