/**
 * useAiKeyStore — state + handlers for the AI settings UI (active provider,
 * per-provider model overrides, API keys with live-test + last-known-good
 * backup).
 *
 * Reworked from adaptive-learner's `useAiKeySettings`: it operates on the
 * generic `AiSettingsSnapshot` through the injected `AiKeyStoreAdapter` and
 * the provider registry, owns the snapshot itself (fetches on mount, updates
 * on every mutation), and guards the optional adapter capabilities
 * (`testApiKey` / `backupApiKey` / `getApiKeyBackup` / `restoreApiKeyBackup`)
 * so an adapter that does not implement them simply hides those affordances.
 */

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
    subscribeSettingsRefresh,
    type AiSettingsSnapshot,
    type ApiKeyTestResult,
} from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";
import { refreshApiKeyStatus } from "./useApiKeyStatus";

function fromIds<T>(ids: readonly string[], value: T): Record<string, T> {
    return Object.fromEntries(ids.map((id) => [id, value]));
}

export interface UseAiKeyStoreResult {
    snapshot: AiSettingsSnapshot | null;
    loading: boolean;
    busy: string | null;
    keyDrafts: Record<string, string>;
    setKeyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
    modelDrafts: Record<string, string>;
    setModelDrafts: Dispatch<SetStateAction<Record<string, string>>>;
    testResults: Record<string, ApiKeyTestResult | null>;
    backupAvailable: Record<string, boolean>;
    /** Adapter capabilities, surfaced so the UI can hide unavailable actions. */
    canTest: boolean;
    canBackup: boolean;
    handleProviderChange: (provider: string) => Promise<void>;
    handleSaveKey: (provider: string) => Promise<void>;
    handleRestoreBackup: (provider: string) => Promise<void>;
    handleTestKey: (provider: string) => Promise<void>;
    handleSaveModel: (provider: string) => Promise<void>;
    handleClearModel: (provider: string) => Promise<void>;
    handleDeleteKey: (provider: string) => Promise<void>;
}

/** AI settings state + handlers, backed by the injected adapter/registry. */
export function useAiKeyStore(): UseAiKeyStoreResult {
    const { adapter, registry, userId, t, notify, confirm } = useAiSettingsContext();
    const ids = registry.ids;
    const canTest = typeof adapter.testApiKey === "function";
    const canBackup =
        typeof adapter.backupApiKey === "function" &&
        typeof adapter.getApiKeyBackup === "function";

    const [snapshot, setSnapshot] = useState<AiSettingsSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>(() =>
        fromIds(ids, ""),
    );
    const [modelDrafts, setModelDrafts] = useState<Record<string, string>>(() =>
        fromIds(ids, ""),
    );
    const [busy, setBusy] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<
        Record<string, ApiKeyTestResult | null>
    >(() => fromIds(ids, null));
    const [backupAvailable, setBackupAvailable] = useState<Record<string, boolean>>(
        () => fromIds(ids, false),
    );

    const applySnapshot = useCallback(
        (next: AiSettingsSnapshot) => {
            setSnapshot(next);
            setModelDrafts((prev) => {
                const merged = { ...prev };
                for (const id of ids) merged[id] = next.modelOverride[id] ?? "";
                return merged;
            });
        },
        [ids],
    );

    useEffect(() => {
        if (!userId) {
            setSnapshot(null);
            setLoading(false);
            return;
        }
        let alive = true;
        setLoading(true);
        void adapter
            .getSettings(userId)
            .then((snap) => {
                if (alive) {
                    applySnapshot(snap);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [adapter, userId, applySnapshot]);

    // React to out-of-band settings mutations (e.g. an encrypted key-vault
    // import, or a backup restore) announced on the shared settings-refresh
    // bus, so the panel reflects them WITHOUT a reload (#1836). The import
    // form lives elsewhere in the tree and emits on this bus after writing
    // the keys; without this the panel would keep showing the pre-import
    // snapshot until remount.
    useEffect(() => {
        if (!userId) return;
        return subscribeSettingsRefresh(() => {
            void adapter
                .getSettings(userId)
                .then((snap) => applySnapshot(snap))
                .catch(() => {
                    /* keep the last good snapshot on a transient read failure */
                });
        });
    }, [adapter, userId, applySnapshot]);

    const notifyError = useCallback(
        (err: unknown) => {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : t("common.error", "Something went wrong.");
            notify.error(message);
        },
        [notify, t],
    );

    const handleProviderChange = useCallback(
        async (provider: string) => {
            if (busy || !userId) return;
            setBusy("provider");
            try {
                const updated = await adapter.patchSettings(userId, {
                    activeProvider: provider,
                });
                applySnapshot(updated);
                await refreshApiKeyStatus(adapter, registry, userId);
                notify.success(t("settings.saved", "Saved."));
            } catch (err) {
                notifyError(err);
            } finally {
                setBusy(null);
            }
        },
        [adapter, registry, userId, busy, applySnapshot, notify, t, notifyError],
    );

    // Make `provider` active when the current active provider has no stored
    // key yet, so the FIRST working key immediately unlocks the AI gate.
    const ensureUsableActiveProvider = useCallback(
        async (current: AiSettingsSnapshot, provider: string): Promise<AiSettingsSnapshot> => {
            const active = current.activeProvider;
            const activeHasKey = !!(active && current.hasKey[active]);
            if (active === provider || activeHasKey) return current;
            return adapter.patchSettings(userId as string, { activeProvider: provider });
        },
        [adapter, userId],
    );

    const persistKey = useCallback(
        async (provider: string, key: string) => {
            const saved = await adapter.setApiKey(userId as string, provider, key);
            const activated = await ensureUsableActiveProvider(saved, provider);
            applySnapshot(activated);
            setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
            await refreshApiKeyStatus(adapter, registry, userId);
            notify.success(t("toast.api_key_saved", "API key saved."));
        },
        [adapter, registry, userId, ensureUsableActiveProvider, applySnapshot, notify, t],
    );

    const handleSaveKey = useCallback(
        async (provider: string) => {
            if (busy || !userId) return;
            const key = (keyDrafts[provider] ?? "").trim();
            if (key.length === 0) return;
            setBusy(`save-${provider}`);
            try {
                await persistKey(provider, key);
                if (!canTest) return;
                let test: ApiKeyTestResult;
                try {
                    test = await adapter.testApiKey!(userId, provider, key);
                } catch {
                    test = { success: false, kind: "network" };
                }
                setTestResults((prev) => ({ ...prev, [provider]: test }));
                if (test.success && canBackup) {
                    await adapter.backupApiKey!(userId, provider, key);
                    setBackupAvailable((prev) => ({ ...prev, [provider]: true }));
                } else if (canBackup) {
                    const info = await adapter
                        .getApiKeyBackup!(userId, provider)
                        .catch(() => ({ has: false, testedAt: null }));
                    setBackupAvailable((prev) => ({ ...prev, [provider]: info.has }));
                }
            } catch (err) {
                notifyError(err);
            } finally {
                setBusy(null);
            }
        },
        [adapter, userId, busy, keyDrafts, persistKey, canTest, canBackup, notifyError],
    );

    const handleRestoreBackup = useCallback(
        async (provider: string) => {
            if (busy || !userId || !adapter.restoreApiKeyBackup) return;
            setBusy(`restore-${provider}`);
            try {
                const updated = await adapter.restoreApiKeyBackup(userId, provider);
                applySnapshot(updated);
                setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
                await refreshApiKeyStatus(adapter, registry, userId);
                if (adapter.testApiKey) {
                    const test = await adapter.testApiKey(userId, provider);
                    setTestResults((prev) => ({ ...prev, [provider]: test }));
                }
                notify.success(t("toast.api_key_restored", "Last working key restored."));
            } catch (err) {
                notifyError(err);
            } finally {
                setBusy(null);
            }
        },
        [adapter, registry, userId, busy, applySnapshot, notify, t, notifyError],
    );

    const handleTestKey = useCallback(
        async (provider: string) => {
            if (busy || !userId || !adapter.testApiKey) return;
            const draft = (keyDrafts[provider] ?? "").trim();
            setBusy(`test-${provider}`);
            setTestResults((prev) => ({ ...prev, [provider]: null }));
            try {
                const result = await adapter.testApiKey(
                    userId,
                    provider,
                    draft.length > 0 ? draft : undefined,
                );
                setTestResults((prev) => ({ ...prev, [provider]: result }));
                if (result.success && draft.length > 0) {
                    await persistKey(provider, draft);
                    if (canBackup) {
                        await adapter.backupApiKey!(userId, provider, draft);
                        setBackupAvailable((prev) => ({ ...prev, [provider]: true }));
                    }
                }
            } catch {
                setTestResults((prev) => ({
                    ...prev,
                    [provider]: { success: false, kind: "network" },
                }));
            } finally {
                setBusy(null);
            }
        },
        [adapter, userId, busy, keyDrafts, persistKey, canBackup],
    );

    const handleSaveModel = useCallback(
        async (provider: string) => {
            if (busy || !userId || !snapshot) return;
            const draft = (modelDrafts[provider] ?? "").trim();
            const current = snapshot.modelOverride[provider] ?? "";
            if (draft === current) return;
            setBusy(`save-model-${provider}`);
            try {
                const updated = await adapter.patchSettings(userId, {
                    modelOverride: { [provider]: draft.length > 0 ? draft : null },
                });
                applySnapshot(updated);
                notify.success(t("settings.saved", "Saved."));
            } catch (err) {
                notifyError(err);
            } finally {
                setBusy(null);
            }
        },
        [adapter, userId, busy, snapshot, modelDrafts, applySnapshot, notify, t, notifyError],
    );

    const handleClearModel = useCallback(
        async (provider: string) => {
            if (busy || !userId) return;
            setBusy(`clear-model-${provider}`);
            try {
                const updated = await adapter.patchSettings(userId, {
                    modelOverride: { [provider]: null },
                });
                applySnapshot(updated);
                setModelDrafts((prev) => ({ ...prev, [provider]: "" }));
                notify.success(t("settings.saved", "Saved."));
            } catch (err) {
                notifyError(err);
            } finally {
                setBusy(null);
            }
        },
        [adapter, userId, busy, applySnapshot, notify, t, notifyError],
    );

    const handleDeleteKey = useCallback(
        async (provider: string) => {
            if (busy || !userId) return;
            const ok = await confirm({
                message: t("settings.api_key_confirm_delete", "Really remove this API key?"),
                confirmLabel: t("common.remove", "Remove"),
                variant: "danger",
            });
            if (!ok) return;
            setBusy(`delete-${provider}`);
            try {
                const updated = await adapter.deleteApiKey(userId, provider);
                applySnapshot(updated);
                await refreshApiKeyStatus(adapter, registry, userId);
                notify.success(t("toast.api_key_deleted", "API key removed."));
            } catch (err) {
                notifyError(err);
            } finally {
                setBusy(null);
            }
        },
        [adapter, registry, userId, busy, confirm, applySnapshot, notify, t, notifyError],
    );

    return {
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
        canBackup,
        handleProviderChange,
        handleSaveKey,
        handleRestoreBackup,
        handleTestKey,
        handleSaveModel,
        handleClearModel,
        handleDeleteKey,
    };
}
