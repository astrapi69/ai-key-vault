/**
 * KeyVaultImportForm — the Import half of the key vault. Two independent
 * input paths feed the SAME decrypt/import call: choose the encrypted file,
 * OR paste the raw envelope JSON. The passphrase is always required. Pasted
 * text is structurally validated before Import enables; malformed JSON
 * surfaces an inline error, never a crash. On success it refreshes the
 * settings view via the core bus so the AI tab reflects the imported key
 * without a reload.
 */

import { useRef, useState } from "react";
import {
    KEY_VAULT_EXTENSION,
    VaultDecryptError,
    emitSettingsRefresh,
    importEncryptedKeyVault,
    looksLikeVaultEnvelope,
    type KeyVaultImportResult,
} from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";
import { SecretInput } from "../SecretInput";

export interface KeyVaultImportFormProps {
    /**
     * Called after a successful import. Receives the import result so the
     * parent can report which providers got a key (e.g. "2 keys imported")
     * and flip its "has keys" gate. A no-argument handler stays valid.
     */
    onImported: (result: KeyVaultImportResult) => void;
}

/** The plaintext ``format`` an envelope declares, or ``undefined`` for
 *  non-JSON input. Used for format-agnostic import validation. */
function envelopeFormatOf(text: string): string | undefined {
    try {
        const env = JSON.parse(text) as { format?: unknown };
        return typeof env.format === "string" ? env.format : undefined;
    } catch {
        return undefined;
    }
}

export function KeyVaultImportForm({ onImported }: KeyVaultImportFormProps) {
    const { t, notify, Button, adapter, registry, userId, importProviderAliases } =
        useAiSettingsContext();
    const [importPass, setImportPass] = useState("");
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importText, setImportText] = useState("");
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const importTextTrimmed = importText.trim();
    const importTextPresent = importTextTrimmed.length > 0;
    // Format-AGNOSTIC: accept any well-formed vault envelope, whatever app
    // stamped it, by validating against the file's OWN declared format. This
    // is what lets a user paste a sibling app's export and import it here.
    const importTextEnvelopeFormat = envelopeFormatOf(importTextTrimmed);
    const importTextValid =
        importTextPresent &&
        importTextEnvelopeFormat !== undefined &&
        looksLikeVaultEnvelope(importTextTrimmed, { format: importTextEnvelopeFormat });
    const importTextInvalid = importTextPresent && !importTextValid;
    const importHasSource = importTextValid || importFile !== null;
    const importValid = importHasSource && !importTextInvalid && importPass.length > 0;

    async function handleImport(): Promise<void> {
        if (!userId || !importValid) return;
        setBusy(true);
        try {
            const envelopeText = importTextValid
                ? importTextTrimmed
                : await importFile!.text();
            const result = await importEncryptedKeyVault(
                adapter,
                userId,
                envelopeText,
                importPass,
                {
                    providerIds: registry.ids,
                    // Import is format-agnostic (core decrypts with the file's
                    // own format); aliases port a sibling app's provider ids.
                    providerAliases: importProviderAliases,
                },
            );
            setImportPass("");
            setImportFile(null);
            setImportText("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            onImported(result);
            emitSettingsRefresh();
            notify.success(
                t("settings.key_vault.success_import", "Keys imported. AI features are ready again."),
            );
        } catch (err) {
            handleImportError(err);
        } finally {
            setBusy(false);
        }
    }

    function handleImportError(err: unknown): void {
        if (err instanceof VaultDecryptError) {
            // Expected, user-correctable (wrong passphrase or a corrupt/foreign
            // file): a plain warning, not a red error toast.
            notify.warning(
                t("settings.key_vault.error_decrypt", "Passphrase incorrect or file corrupted."),
            );
        } else {
            notify.error(t("settings.key_vault.error_import", "Could not import the key file."));
        }
    }

    return (
        <div className="flex flex-col gap-2" data-testid="key-vault-import">
            <h3 className="text-sm font-semibold text-foreground">
                {t("settings.key_vault.import_heading", "Import")}
            </h3>
            <p className="text-xs text-muted-foreground">
                {t(
                    "settings.key_vault.import_hint",
                    "Choose the encrypted key file, or paste its contents below. Either way works.",
                )}
            </p>
            <input
                ref={fileInputRef}
                type="file"
                accept={KEY_VAULT_EXTENSION}
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                aria-label={t("settings.key_vault.import_file_label", "Encrypted key file")}
                className="akv-file-input text-sm text-foreground"
                data-testid="key-vault-import-file"
            />
            <label className="text-xs text-muted-foreground" htmlFor="key-vault-import-text">
                {t("settings.key_vault.import_text_label", "…or paste the key file contents")}
            </label>
            <textarea
                id="key-vault-import-text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={t(
                    "settings.key_vault.import_text_placeholder",
                    '{ "format": "…", … }',
                )}
                aria-invalid={importTextInvalid || undefined}
                aria-describedby={importTextInvalid ? "key-vault-import-text-error" : undefined}
                className="w-full rounded-app border border-border bg-background p-2 font-mono text-xs text-foreground"
                data-testid="key-vault-import-text"
            />
            <p
                id="key-vault-import-text-error"
                role="alert"
                aria-live="polite"
                className="min-h-4 text-xs text-destructive"
                data-testid="key-vault-import-text-error"
            >
                {importTextInvalid
                    ? t(
                          "settings.key_vault.import_text_invalid",
                          "This does not look like a valid key file. Check that you pasted the whole contents.",
                      )
                    : ""}
            </p>
            <SecretInput
                value={importPass}
                onChange={(e) => setImportPass(e.target.value)}
                placeholder={t("settings.key_vault.passphrase_label", "Passphrase")}
                aria-label={t("settings.key_vault.passphrase_label", "Passphrase")}
                data-testid="key-vault-import-pass"
            />
            <div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleImport()}
                    disabled={busy || !importValid}
                    data-testid="key-vault-import-button"
                >
                    {busy
                        ? t("settings.key_vault.busy", "Working…")
                        : t("settings.key_vault.import_button", "Import key file")}
                </Button>
            </div>
        </div>
    );
}
