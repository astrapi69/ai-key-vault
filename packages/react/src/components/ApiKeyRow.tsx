/**
 * ApiKeyRow — one provider's API-key form (status, secret input, save /
 * live-test / delete controls, format-validation feedback, and the
 * non-blocking "restore last working key" link). Presentation only; state +
 * handlers come from `useAiKeyStore` via the panel.
 */

import {
    isValidApiKeyFormat,
    type AiProviderDescriptor,
    type AiSettingsSnapshot,
    type ApiKeyTestResult,
    type KeySource,
    type Translate,
} from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";
import { SecretInput } from "../SecretInput";

type FormatState = "empty" | "valid" | "invalid";

function formatStateFor(descriptor: AiProviderDescriptor, draft: string): FormatState {
    if (draft.trim().length === 0) return "empty";
    return isValidApiKeyFormat(descriptor.keyFormat, draft) ? "valid" : "invalid";
}

function keySourceLabel(source: KeySource, t: Translate): string {
    if (source === "secrets_file")
        return t("settings.api_key_source_file", "Key from: secrets file");
    if (source === "env") return t("settings.api_key_source_env", "Key from: environment");
    if (source === "settings") return t("settings.api_key_source_settings", "Key from: Settings");
    return t("settings.api_key_source_none", "No key configured");
}

function testResultClass(kind: ApiKeyTestResult["kind"]): string {
    if (kind === "ok") return "is-ok";
    if (kind === "invalid") return "is-invalid";
    return "is-warning";
}

function testResultMessage(kind: ApiKeyTestResult["kind"], t: Translate): string {
    if (kind === "ok") return `✓ ${t("settings.api_key.test_success", "Key works!")}`;
    if (kind === "invalid")
        return `✗ ${t("settings.api_key.test_invalid", "Key invalid or expired.")}`;
    if (kind === "rate_limit")
        return `⚠ ${t("settings.api_key.test_rate_limit", "Rate limit hit. Try later.")}`;
    if (kind === "no_key") return `⚠ ${t("settings.api_key.test_no_key", "No key to test.")}`;
    if (kind === "error")
        return `✗ ${t("settings.api_key.test_error", "Test failed. The provider rejected the request.")}`;
    return `⚠ ${t("settings.api_key.test_network", "Connection failed. Check your internet connection.")}`;
}

export interface ApiKeyRowProps {
    descriptor: AiProviderDescriptor;
    snapshot: AiSettingsSnapshot;
    draft: string;
    busy: string | null;
    testResult: ApiKeyTestResult | null;
    backupAvailable: boolean;
    canTest: boolean;
    onDraftChange: (value: string) => void;
    onSave: () => void;
    onTest: () => void;
    onDelete: () => void;
    onRestoreBackup: () => void;
}

/** A single provider's API-key form. */
export function ApiKeyRow({
    descriptor,
    snapshot,
    draft,
    busy,
    testResult,
    backupAvailable,
    canTest,
    onDraftChange,
    onSave,
    onTest,
    onDelete,
    onRestoreBackup,
}: ApiKeyRowProps) {
    const { t, Button } = useAiSettingsContext();
    const provider = descriptor.id;
    const has = !!snapshot.hasKey[provider];
    const isActive = snapshot.activeProvider === provider;
    const source: KeySource = snapshot.keySource[provider] ?? "none";
    // Only an env-var key is truly read-only from the UI. A secrets-file key
    // is editable (saving overwrites it); settings / none were always editable.
    const externallyManaged = source === "env";
    const fromSecretsFile = source === "secrets_file";
    const formatState = formatStateFor(descriptor, draft);
    const testing = busy === `test-${provider}`;
    const testLabel = testing
        ? t("settings.api_key.testing", "Testing…")
        : t("settings.api_key.test", "Test");
    const showStandaloneRestore =
        backupAvailable && testResult !== null && !testResult.success;

    return (
        <div
            className={`api-key-row${isActive ? " is-active-provider" : ""}`}
            data-testid={`api-key-row-${provider}`}
        >
            <div className="api-key-row-head">
                <strong>{descriptor.label}</strong>
                {isActive && (
                    <span className="api-key-active-badge" data-testid={`api-key-active-${provider}`}>
                        {t("settings.provider_active", "Active")}
                    </span>
                )}
                <span
                    className={`api-key-status ${has ? "is-set" : "is-missing"}`}
                    data-testid={`api-key-status-${provider}`}
                >
                    {has
                        ? t("settings.api_key_saved", "Key stored")
                        : t("settings.api_key_missing", "Not set")}
                </span>
                <span
                    className={`api-key-source api-key-source-${source}`}
                    data-testid={`api-key-source-${provider}`}
                >
                    {keySourceLabel(source, t)}
                </span>
            </div>
            {externallyManaged && (
                <p className="api-key-external-hint" data-testid={`api-key-external-${provider}`}>
                    {t(
                        "settings.api_key_external_hint_env",
                        "This key is configured via an environment variable and cannot be edited here.",
                    )}
                </p>
            )}
            {fromSecretsFile && (
                <p className="api-key-source-file-hint" data-testid={`api-key-info-${provider}`}>
                    {t(
                        "settings.api_key_external_hint_file",
                        "Stored in a secrets file. Saving here overwrites it.",
                    )}
                </p>
            )}
            {isActive && !has && !externallyManaged && (
                <p className="api-key-warning" data-testid={`api-key-warning-${provider}`}>
                    {t(
                        "settings.active_provider_missing_key",
                        "This is your active provider but no API key is stored. AI replies will be skipped until a key is saved.",
                    )}
                </p>
            )}
            <div className="api-key-row-input">
                <span className={`api-key-input-wrap api-key-format-${formatState}`}>
                    <SecretInput
                        data-testid={`api-key-input-${provider}`}
                        placeholder={
                            has && !externallyManaged
                                ? t(
                                      "settings.api_key_placeholder_replace",
                                      "Paste a new key to replace the stored one…",
                                  )
                                : t("settings.api_key_placeholder", "Paste here…")
                        }
                        aria-label={`${t("settings.api_key_label", "API key")} (${descriptor.label})`}
                        aria-invalid={formatState === "invalid"}
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        disabled={busy === `save-${provider}` || externallyManaged}
                    />
                    {formatState === "valid" && (
                        <span
                            className="api-key-format-check"
                            data-testid={`api-key-format-ok-${provider}`}
                            aria-hidden="true"
                        >
                            ✓
                        </span>
                    )}
                </span>
                <Button
                    type="button"
                    data-testid={`api-key-save-${provider}`}
                    onClick={onSave}
                    disabled={
                        busy === `save-${provider}` || formatState !== "valid" || externallyManaged
                    }
                    aria-label={t("settings.api_key_set", "Save key")}
                    title={t("settings.api_key_set", "Save key")}
                >
                    {t("settings.api_key_set", "Save key")}
                </Button>
                {canTest && (has || formatState === "valid") && (
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid={`api-key-test-${provider}`}
                        onClick={onTest}
                        disabled={testing}
                        aria-label={testLabel}
                        title={testLabel}
                    >
                        {testLabel}
                    </Button>
                )}
                {has && !externallyManaged && (
                    <Button
                        type="button"
                        variant="destructive"
                        data-testid={`api-key-delete-${provider}`}
                        onClick={onDelete}
                        disabled={busy === `delete-${provider}`}
                        aria-label={t("settings.api_key_delete", "Remove key")}
                        title={t("settings.api_key_delete", "Remove key")}
                    >
                        {t("settings.api_key_delete", "Remove key")}
                    </Button>
                )}
            </div>
            {testResult && (
                <p
                    className={`api-key-test-result ${testResultClass(testResult.kind)}`}
                    data-testid={`api-key-test-result-${provider}`}
                    role="status"
                >
                    {testResultMessage(testResult.kind, t)}
                </p>
            )}
            {formatState === "invalid" && (
                <p className="api-key-format-error" data-testid={`api-key-format-error-${provider}`}>
                    {t("settings.api_key.format_invalid", "Invalid format.")}{" "}
                    {descriptor.keyFormatHint
                        ? t(`settings.api_key.format_hint.${provider}`, descriptor.keyFormatHint)
                        : ""}
                </p>
            )}
            {showStandaloneRestore && (
                <Button
                    type="button"
                    variant="link"
                    className="api-key-restore-link"
                    data-testid={`api-key-restore-link-${provider}`}
                    onClick={onRestoreBackup}
                    disabled={busy === `restore-${provider}`}
                >
                    {t("settings.api_key.rollback_restore", "Restore last working key")}
                </Button>
            )}
        </div>
    );
}
