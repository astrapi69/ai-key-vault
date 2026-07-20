/**
 * KeyVaultSection — passphrase-encrypted export/import of the AI keys +
 * provider settings, separate from the app's normal backup (which never
 * carries keys).
 *
 * Capability-aware: when the adapter reports `clientReadableKeys: false`
 * (keys managed server-side and unreadable as plaintext on the client), the
 * export form is replaced by a notice — import still works. Export is
 * enabled only when at least one key exists.
 */

import { useEffect, useState } from "react";
import {
    KEY_VAULT_EXTENSION,
    buildEncryptedKeyVault,
    hasExportableKey,
} from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";
import { SecretInput } from "../SecretInput";
import { KeyVaultImportForm } from "./KeyVaultImportForm";

const MIN_PASSPHRASE_LENGTH = 8;
const EXPORT_FILENAME = `ai-keys${KEY_VAULT_EXTENSION}`;

function downloadText(content: string, filename: string): void {
    const blob = new Blob([content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/** Encrypted key export/import section. */
export function KeyVaultSection() {
    const { t, notify, Button, adapter, registry, userId, vaultFormat } =
        useAiSettingsContext();
    const clientReadable = adapter.capabilities.clientReadableKeys;

    const [hasKeys, setHasKeys] = useState<boolean | null>(null);
    const [exportPass, setExportPass] = useState("");
    const [exportConfirm, setExportConfirm] = useState("");
    const [busy, setBusy] = useState<"export" | null>(null);

    useEffect(() => {
        if (!clientReadable || !userId) {
            setHasKeys(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const keys = await adapter.exportApiKeys(userId);
                if (!cancelled) setHasKeys(hasExportableKey(registry.ids, keys));
            } catch {
                if (!cancelled) setHasKeys(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [adapter, registry, clientReadable, userId]);

    const exportTooShort =
        exportPass.length > 0 && exportPass.length < MIN_PASSPHRASE_LENGTH;
    const exportMismatch = exportConfirm.length > 0 && exportConfirm !== exportPass;
    const exportValid =
        exportPass.length >= MIN_PASSPHRASE_LENGTH && exportConfirm === exportPass;

    async function handleExport(): Promise<void> {
        if (!userId || !exportValid) return;
        setBusy("export");
        try {
            const envelope = await buildEncryptedKeyVault(adapter, userId, exportPass, {
                providerIds: registry.ids,
                format: vaultFormat,
            });
            if (envelope === null) {
                notify.warning(
                    t("settings.key_vault.no_keys", "There are no AI keys to export yet."),
                );
                return;
            }
            downloadText(envelope, EXPORT_FILENAME);
            setExportPass("");
            setExportConfirm("");
            notify.success(
                t("settings.key_vault.success_export", "Encrypted key file downloaded."),
            );
        } catch {
            notify.error(t("settings.key_vault.error_export", "Could not create the export."));
        } finally {
            setBusy(null);
        }
    }

    return (
        <section className="settings-section" data-testid="key-vault-section">
            <h2 className="settings-section-title inline-flex items-center gap-2">
                {t("settings.key_vault.title", "AI keys — encrypted export")}
            </h2>
            <p className="text-sm text-muted-foreground">
                {t(
                    "settings.key_vault.intro",
                    "Move your AI keys to another device in one encrypted file, separate from the normal backup (which never contains keys).",
                )}
            </p>

            {!clientReadable ? (
                <div className="flex flex-col gap-6">
                    <p
                        className="rounded-app border border-border bg-muted p-3 text-sm text-muted-foreground"
                        data-testid="key-vault-api-notice"
                    >
                        {t(
                            "settings.key_vault.api_export_disabled",
                            "In server mode keys cannot be exported - they are managed encrypted on the server. Importing a key file still works.",
                        )}
                    </p>
                    <KeyVaultImportForm onImported={() => setHasKeys(true)} />
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2" data-testid="key-vault-export">
                        <h3 className="text-sm font-semibold text-foreground">
                            {t("settings.key_vault.export_heading", "Export")}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                "settings.key_vault.passphrase_hint",
                                "Choose a strong passphrase. It cannot be recovered — without it the file cannot be opened.",
                            )}
                        </p>
                        <SecretInput
                            value={exportPass}
                            onChange={(e) => setExportPass(e.target.value)}
                            placeholder={t("settings.key_vault.passphrase_label", "Passphrase")}
                            aria-label={t("settings.key_vault.passphrase_label", "Passphrase")}
                            aria-invalid={exportTooShort || undefined}
                            aria-describedby={exportTooShort ? "key-vault-export-pass-hint" : undefined}
                            data-testid="key-vault-export-pass"
                        />
                        {exportTooShort && (
                            <p
                                id="key-vault-export-pass-hint"
                                className="text-xs text-destructive"
                                data-testid="key-vault-export-pass-hint"
                            >
                                {t("settings.key_vault.min_length", "At least {n} characters.").replace(
                                    "{n}",
                                    String(MIN_PASSPHRASE_LENGTH),
                                )}
                            </p>
                        )}
                        <SecretInput
                            value={exportConfirm}
                            onChange={(e) => setExportConfirm(e.target.value)}
                            placeholder={t("settings.key_vault.confirm_label", "Confirm passphrase")}
                            aria-label={t("settings.key_vault.confirm_label", "Confirm passphrase")}
                            aria-invalid={exportMismatch || undefined}
                            aria-describedby={exportMismatch ? "key-vault-export-confirm-hint" : undefined}
                            data-testid="key-vault-export-confirm"
                        />
                        {exportMismatch && (
                            <p
                                id="key-vault-export-confirm-hint"
                                className="text-xs text-destructive"
                                data-testid="key-vault-export-confirm-hint"
                            >
                                {t("settings.key_vault.error_mismatch", "The passphrases do not match.")}
                            </p>
                        )}
                        {hasKeys === false && (
                            <p className="text-xs text-muted-foreground" data-testid="key-vault-no-keys">
                                {t("settings.key_vault.no_keys", "There are no AI keys to export yet.")}
                            </p>
                        )}
                        <div>
                            <Button
                                type="button"
                                onClick={() => void handleExport()}
                                disabled={busy !== null || hasKeys !== true || !exportValid}
                                data-testid="key-vault-export-button"
                            >
                                {busy === "export"
                                    ? t("settings.key_vault.busy", "Working…")
                                    : t("settings.key_vault.export_button", "Export encrypted file")}
                            </Button>
                        </div>
                    </div>
                    <KeyVaultImportForm onImported={() => setHasKeys(true)} />
                </div>
            )}
        </section>
    );
}
