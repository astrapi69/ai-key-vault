/**
 * AiSettingsPanel — the AI settings surface: the configured-providers
 * overview, an active-provider select, per-provider model overrides, and the
 * API-key manager. All state + handlers come from `useAiKeyStore`; this is
 * the presentation layer.
 *
 * The model-override field uses the injected `ModelPicker` slot when the host
 * provides one (e.g. with live model discovery); otherwise a plain input with
 * the descriptor's recommended models as datalist suggestions.
 */

import { useId } from "react";
import type { AiProviderDescriptor } from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";
import { useAiKeyStore } from "../hooks/useAiKeyStore";
import { ApiKeyRow } from "./ApiKeyRow";
import { ConfiguredProvidersTable } from "./ConfiguredProvidersTable";

/** Scroll a provider's key input into view + focus it (no-op under happy-dom). */
function focusProviderInput(provider: string): void {
    if (typeof document === "undefined") return;
    const el = document.querySelector<HTMLInputElement>(
        `[data-testid="api-key-input-${provider}"]`,
    );
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el?.focus?.();
}

export interface AiSettingsPanelProps {
    /** Whether the panel is the active tab (drives `hidden`). Default true. */
    active?: boolean;
    /** Optional: jump to the encrypted key export (e.g. a Data tab). */
    onOpenKeyExport?: () => void;
    /** Optional: jump to the encrypted key import. */
    onOpenKeyImport?: () => void;
}

/** Provider / model-override / API-key sections of the AI settings tab. */
export function AiSettingsPanel({
    active = true,
    onOpenKeyExport,
    onOpenKeyImport,
}: AiSettingsPanelProps) {
    const { t, Button, registry } = useAiSettingsContext();
    const store = useAiKeyStore();
    const {
        snapshot,
        loading,
        busy,
        keyDrafts,
        setKeyDrafts,
        modelDrafts,
        setModelDrafts,
        testResults,
        backupAvailable,
        canTest,
        handleProviderChange,
        handleSaveKey,
        handleRestoreBackup,
        handleTestKey,
        handleSaveModel,
        handleClearModel,
        handleDeleteKey,
    } = store;

    if (loading || !snapshot) {
        return (
            <div
                className="settings-tabpanel"
                role="tabpanel"
                hidden={!active}
                data-testid="settings-panel-ai"
            >
                <p className="muted" role="status">
                    {t("common.loading", "Loading…")}
                </p>
            </div>
        );
    }

    return (
        <div
            className="settings-tabpanel"
            role="tabpanel"
            hidden={!active}
            data-testid="settings-panel-ai"
        >
            <ConfiguredProvidersTable
                snapshot={snapshot}
                busy={busy}
                testResults={testResults}
                canTest={canTest}
                onSetActive={handleProviderChange}
                onEdit={focusProviderInput}
                onDelete={handleDeleteKey}
                onTest={handleTestKey}
                onImportKeys={onOpenKeyImport}
            />

            <section className="settings-section">
                <h2 className="settings-section-title">{t("settings.section_provider", "AI provider")}</h2>
                <label className="form-row">
                    <span className="form-label">{t("settings.provider_label", "Active provider")}</span>
                    <select
                        data-testid="settings-provider"
                        value={snapshot.activeProvider ?? ""}
                        disabled={busy === "provider"}
                        onChange={(e) => handleProviderChange(e.target.value)}
                    >
                        {registry.all().map((descriptor) => (
                            <option key={descriptor.id} value={descriptor.id}>
                                {descriptor.label}
                            </option>
                        ))}
                    </select>
                </label>
            </section>

            <section className="settings-section" data-testid="settings-model-overrides">
                <h2 className="settings-section-title">
                    {t("settings.section_model_overrides", "Model overrides")}
                </h2>
                <p className="muted">
                    {t(
                        "settings.model_overrides_hint",
                        "Leave blank to use the default model for each provider. A non-empty value replaces the default at chat time.",
                    )}
                </p>
                {registry.all().map((descriptor) => (
                    <ModelOverrideRow
                        key={descriptor.id}
                        descriptor={descriptor}
                        current={snapshot.modelOverride[descriptor.id] ?? ""}
                        draft={modelDrafts[descriptor.id] ?? ""}
                        hasKey={!!snapshot.hasKey[descriptor.id]}
                        isActive={snapshot.activeProvider === descriptor.id}
                        busy={busy}
                        onDraftChange={(next) =>
                            setModelDrafts((prev) => ({ ...prev, [descriptor.id]: next }))
                        }
                        onSave={() => handleSaveModel(descriptor.id)}
                        onClear={() => handleClearModel(descriptor.id)}
                    />
                ))}
            </section>

            <section className="settings-section">
                <h2 className="settings-section-title">{t("settings.section_api_keys", "API keys")}</h2>
                {registry.all().map((descriptor) => (
                    <ApiKeyRow
                        key={descriptor.id}
                        descriptor={descriptor}
                        snapshot={snapshot}
                        draft={keyDrafts[descriptor.id] ?? ""}
                        busy={busy}
                        testResult={testResults[descriptor.id] ?? null}
                        backupAvailable={backupAvailable[descriptor.id] ?? false}
                        canTest={canTest}
                        onDraftChange={(value) =>
                            setKeyDrafts((prev) => ({ ...prev, [descriptor.id]: value }))
                        }
                        onSave={() => handleSaveKey(descriptor.id)}
                        onTest={() => handleTestKey(descriptor.id)}
                        onDelete={() => handleDeleteKey(descriptor.id)}
                        onRestoreBackup={() => handleRestoreBackup(descriptor.id)}
                    />
                ))}
            </section>

            {onOpenKeyExport && (
                <section className="settings-section">
                    <h2 className="settings-section-title">
                        {t("settings.key_export_link.heading", "AI keys — encrypted export")}
                    </h2>
                    <p className="muted">
                        {t(
                            "settings.key_export_link.hint",
                            "Export or import your AI keys as a single encrypted file.",
                        )}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onOpenKeyExport}
                        data-testid="ai-key-export-link"
                    >
                        {t("settings.key_export_link.button", "Go to key export")}
                    </Button>
                </section>
            )}
        </div>
    );
}

interface ModelOverrideRowProps {
    descriptor: AiProviderDescriptor;
    current: string;
    draft: string;
    hasKey: boolean;
    isActive: boolean;
    busy: string | null;
    onDraftChange: (next: string) => void;
    onSave: () => void;
    onClear: () => void;
}

function ModelOverrideRow({
    descriptor,
    current,
    draft,
    hasKey,
    isActive,
    busy,
    onDraftChange,
    onSave,
    onClear,
}: ModelOverrideRowProps) {
    const { t, Button, Input, ModelPicker, userId } = useAiSettingsContext();
    const provider = descriptor.id;
    const dirty = draft.trim() !== current;
    const datalistId = useId();

    return (
        <div
            className={`model-override-row${isActive ? " is-active-provider" : ""}`}
            data-testid={`model-override-row-${provider}`}
        >
            <div className="model-override-row-head">
                <strong>{descriptor.label}</strong>
                {isActive && (
                    <span
                        className="api-key-active-badge"
                        data-testid={`model-override-active-${provider}`}
                    >
                        {t("settings.provider_active", "Active")}
                    </span>
                )}
                <span
                    className={`api-key-status ${current ? "is-set" : "is-missing"}`}
                    data-testid={`model-override-status-${provider}`}
                >
                    {current
                        ? t("settings.model_override_set", "Override active")
                        : t("settings.model_override_default", "Default model")}
                </span>
            </div>
            <div className="model-override-row-input">
                {ModelPicker ? (
                    <ModelPicker
                        userId={userId ?? ""}
                        provider={provider}
                        value={current}
                        draft={draft}
                        onDraftChange={onDraftChange}
                        defaultModel={descriptor.defaultModel}
                        hasApiKey={hasKey}
                        disabled={busy === `save-model-${provider}`}
                    />
                ) : (
                    <>
                        <Input
                            list={datalistId}
                            value={draft}
                            placeholder={descriptor.defaultModel}
                            aria-label={`${t("settings.model_override_label", "Model")} (${descriptor.label})`}
                            onChange={(e) => onDraftChange(e.target.value)}
                            disabled={busy === `save-model-${provider}`}
                            data-testid={`model-override-input-${provider}`}
                        />
                        <datalist id={datalistId}>
                            {(descriptor.recommendedModels ?? []).map((model) => (
                                <option key={model} value={model} />
                            ))}
                        </datalist>
                    </>
                )}
                <Button
                    type="button"
                    data-testid={`model-override-save-${provider}`}
                    onClick={onSave}
                    disabled={busy === `save-model-${provider}` || !dirty}
                >
                    {t("settings.model_override_save", "Save model")}
                </Button>
                {current && (
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid={`model-override-clear-${provider}`}
                        onClick={onClear}
                        disabled={busy === `clear-model-${provider}`}
                    >
                        {t("settings.model_override_clear", "Use default")}
                    </Button>
                )}
            </div>
        </div>
    );
}
