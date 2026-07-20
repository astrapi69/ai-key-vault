/**
 * ConfiguredProvidersTable — overview of every configured provider: model,
 * key status, masked preview, an "active provider" radio, and
 * Edit / Add / Test / Delete actions, so a returning user instantly sees
 * WHICH providers have a key stored. Presentation only.
 */

import { useEffect, useState } from "react";
import {
    providerKeyStatus,
    type AiProviderDescriptor,
    type AiSettingsSnapshot,
    type ApiKeyTestResult,
    type ProviderKeyStatus,
    type Translate,
} from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";

const STATUS_CLASS: Record<ProviderKeyStatus, string> = {
    active: "text-success",
    empty: "text-fg-muted",
    desktop_only: "text-warning",
    external: "text-info",
};

function statusLabel(status: ProviderKeyStatus, t: Translate): string {
    if (status === "active") return t("settings.providers.status_active", "Active");
    if (status === "desktop_only")
        return t("settings.providers.status_desktop_only", "Desktop only");
    if (status === "external") return t("settings.providers.status_external", "External");
    return t("settings.providers.status_empty", "Empty");
}

const TEST_OK_VISIBLE_MS = 10_000;

interface TestDisplay {
    tone: "ok" | "error";
    text: string;
}

function testDisplay(result: ApiKeyTestResult | null, t: Translate): TestDisplay | null {
    if (!result) return null;
    if (result.success)
        return { tone: "ok", text: t("settings.providers.test_connection_ok", "Connection ok") };
    if (result.kind === "invalid")
        return { tone: "error", text: t("settings.providers.test_key_invalid", "Key invalid") };
    if (result.kind === "network")
        return { tone: "error", text: t("settings.providers.test_network_error", "Network error") };
    if (result.kind === "rate_limit")
        return { tone: "error", text: t("settings.api_key.test_rate_limit", "Rate limit hit. Try later.") };
    if (result.kind === "no_key")
        return { tone: "error", text: t("settings.api_key.test_no_key", "No key to test.") };
    return {
        tone: "error",
        text: t("settings.api_key.test_error", "Test failed. The provider rejected the request."),
    };
}

function ProviderTestResult({
    provider,
    result,
}: {
    provider: string;
    result: ApiKeyTestResult | null;
}) {
    const { t } = useAiSettingsContext();
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        setVisible(true);
        if (result?.success) {
            const timer = setTimeout(() => setVisible(false), TEST_OK_VISIBLE_MS);
            return () => clearTimeout(timer);
        }
    }, [result]);

    const display = testDisplay(result, t);
    if (!display || !visible) return null;
    return (
        <span
            className={`configured-provider-test-result ${
                display.tone === "ok" ? "text-success" : "text-error"
            }`}
            data-testid={`provider-overview-test-result-${provider}`}
            role="status"
        >
            {display.tone === "ok" ? "✓ " : "✗ "}
            {display.text}
        </span>
    );
}

interface ProviderRow {
    provider: string;
    label: string;
    status: ProviderKeyStatus;
    hasKey: boolean;
    isActive: boolean;
    model: string | null;
    preview: string | null;
}

function buildRow(
    descriptor: AiProviderDescriptor,
    snapshot: AiSettingsSnapshot,
    browserRuntime: boolean,
): ProviderRow {
    const provider = descriptor.id;
    const hasKey = !!snapshot.hasKey[provider];
    const source = snapshot.keySource[provider] ?? "none";
    const status = providerKeyStatus({
        hasKey,
        source,
        browser: browserRuntime,
        corsBlocked: descriptor.corsBlocked ?? false,
    });
    const override = (snapshot.modelOverride[provider] ?? "").trim();
    const model = hasKey ? override || descriptor.defaultModel : null;
    const preview = snapshot.keyPreview[provider] ?? null;
    return {
        provider,
        label: descriptor.label,
        status,
        hasKey,
        isActive: snapshot.activeProvider === provider,
        model,
        preview,
    };
}

export interface ConfiguredProvidersTableProps {
    snapshot: AiSettingsSnapshot;
    busy: string | null;
    testResults: Record<string, ApiKeyTestResult | null>;
    canTest: boolean;
    onSetActive: (provider: string) => void;
    onEdit: (provider: string) => void;
    onDelete: (provider: string) => void;
    onTest: (provider: string) => void;
    onImportKeys?: () => void;
}

/** At-a-glance table of configured AI providers + their key status. */
export function ConfiguredProvidersTable({
    snapshot,
    busy,
    testResults,
    canTest,
    onSetActive,
    onEdit,
    onDelete,
    onTest,
    onImportKeys,
}: ConfiguredProvidersTableProps) {
    const { t, Button, registry, browserRuntime, providerIcons } = useAiSettingsContext();
    const rows = registry.all().map((descriptor) => buildRow(descriptor, snapshot, browserRuntime));

    return (
        <section className="settings-section" data-testid="configured-providers">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="settings-section-title">
                    {t("settings.providers.title", "Configured AI providers")}
                </h2>
                {onImportKeys && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onImportKeys}
                        data-testid="configured-providers-import"
                    >
                        {t("settings.providers.import_keys", "Import")}
                    </Button>
                )}
            </div>
            <p className="muted">
                {t(
                    "settings.providers.hint",
                    "Keys you have saved stay stored. Only a masked preview is shown — never the full key.",
                )}
            </p>
            <ul className="configured-providers-list" role="list">
                {rows.map((row) => {
                    const Icon = providerIcons?.[row.provider];
                    const testing = busy === `test-${row.provider}`;
                    const backendOnly = row.status === "desktop_only";
                    const testLabel = testing
                        ? t("settings.providers.testing", "Testing…")
                        : t("settings.providers.test", "Test");
                    return (
                        <li
                            key={row.provider}
                            className={`configured-provider-row${row.isActive ? " is-active-provider" : ""}`}
                            data-testid={`provider-overview-row-${row.provider}`}
                        >
                            <label className="configured-provider-active">
                                <input
                                    type="radio"
                                    name="active-ai-provider"
                                    checked={row.isActive}
                                    disabled={busy === "provider"}
                                    onChange={() => onSetActive(row.provider)}
                                    aria-label={t("settings.providers.set_active", "Use as active provider")}
                                    data-testid={`provider-overview-active-${row.provider}`}
                                />
                            </label>
                            <span className="configured-provider-name">
                                {Icon && <Icon className="h-5 w-5 text-fg-secondary" />}
                                <strong>{row.label}</strong>
                                {row.isActive && (
                                    <span
                                        className="api-key-active-badge"
                                        data-testid={`provider-overview-badge-${row.provider}`}
                                    >
                                        {t("settings.provider_active", "Active")}
                                    </span>
                                )}
                            </span>
                            <span
                                className="configured-provider-model font-mono text-fg-secondary"
                                data-testid={`provider-overview-model-${row.provider}`}
                            >
                                {row.model ?? "—"}
                            </span>
                            <span
                                className={`configured-provider-status ${STATUS_CLASS[row.status]}`}
                                data-testid={`provider-overview-status-${row.provider}`}
                            >
                                {statusLabel(row.status, t)}
                            </span>
                            <span
                                className="configured-provider-preview font-mono text-fg-muted"
                                data-testid={`provider-overview-preview-${row.provider}`}
                            >
                                {row.preview ?? "—"}
                            </span>
                            <span className="configured-provider-actions">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onEdit(row.provider)}
                                    data-testid={`provider-overview-edit-${row.provider}`}
                                    aria-label={
                                        row.hasKey
                                            ? `${t("settings.providers.edit", "Edit")} (${row.label})`
                                            : `${t("settings.providers.add", "Add key")} (${row.label})`
                                    }
                                    title={
                                        row.hasKey
                                            ? t("settings.providers.edit", "Edit")
                                            : t("settings.providers.add", "Add key")
                                    }
                                >
                                    {row.hasKey
                                        ? t("settings.providers.edit", "Edit")
                                        : t("settings.providers.add", "Add key")}
                                </Button>
                                {canTest && row.hasKey && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onTest(row.provider)}
                                        disabled={testing || backendOnly}
                                        data-testid={`provider-overview-test-${row.provider}`}
                                        aria-label={
                                            backendOnly
                                                ? t("settings.providers.test_backend_only", "Only testable with the backend")
                                                : `${testLabel} (${row.label})`
                                        }
                                        title={
                                            backendOnly
                                                ? t("settings.providers.test_backend_only", "Only testable with the backend")
                                                : testLabel
                                        }
                                    >
                                        {testLabel}
                                    </Button>
                                )}
                                {row.hasKey && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => onDelete(row.provider)}
                                        disabled={busy === `delete-${row.provider}`}
                                        data-testid={`provider-overview-delete-${row.provider}`}
                                        aria-label={`${t("settings.api_key_delete", "Remove key")} (${row.label})`}
                                        title={t("settings.api_key_delete", "Remove key")}
                                    >
                                        {t("settings.api_key_delete", "Remove key")}
                                    </Button>
                                )}
                            </span>
                            <ProviderTestResult provider={row.provider} result={testResults[row.provider] ?? null} />
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
