/**
 * useApiKeyStatus — answers "does the active AI provider have a key?" for
 * every UI surface that gates an AI action, so a button can be disabled with
 * an inline reason instead of surfacing an error toast after the click.
 *
 * Reworked from adaptive-learner's module-cache hook: the adapter + registry
 * + userId come from context, the snapshot is shared across components via a
 * per-userId cache, and it re-reads on the core settings-refresh bus (so an
 * encrypted key-vault import lights up the AI gates without a reload).
 */

import { useCallback, useEffect, useState } from "react";
import {
    emitSettingsRefresh,
    subscribeSettingsRefresh,
    type AiKeyStoreAdapter,
    type ProviderRegistry,
} from "@astrapi69/ai-key-vault";

import { useAiSettingsContext } from "../context";

export interface ApiKeyStatus {
    /** True once the settings read has resolved (success OR failure). */
    ready: boolean;
    /** True iff the active provider has a key. False while not ready. */
    hasKey: boolean;
    /** The resolved active provider, or null until ready. */
    activeProvider: string | null;
    /** Re-read on demand (drop cache, fetch, notify other components). */
    refresh: () => Promise<void>;
}

interface Snapshot {
    ready: boolean;
    hasKey: boolean;
    activeProvider: string | null;
}

const NOT_READY: Snapshot = { ready: false, hasKey: false, activeProvider: null };

const CACHE = new Map<string, Snapshot>();
const INFLIGHT = new Map<string, Promise<Snapshot>>();

async function fetchSnapshot(
    adapter: AiKeyStoreAdapter,
    registry: ProviderRegistry,
    userId: string,
): Promise<Snapshot> {
    const inflight = INFLIGHT.get(userId);
    if (inflight) return inflight;
    const promise = (async (): Promise<Snapshot> => {
        try {
            const settings = await adapter.getSettings(userId);
            const active = settings.activeProvider;
            const hasKey = !!(active && registry.has(active) && settings.hasKey[active]);
            const snap: Snapshot = { ready: true, hasKey, activeProvider: active };
            CACHE.set(userId, snap);
            return snap;
        } catch {
            // Failures are not fatal — treat as "no key", same inline warning a
            // freshly-onboarded user sees.
            const snap: Snapshot = { ready: true, hasKey: false, activeProvider: null };
            CACHE.set(userId, snap);
            return snap;
        } finally {
            INFLIGHT.delete(userId);
        }
    })();
    INFLIGHT.set(userId, promise);
    return promise;
}

/**
 * Imperative refresh usable outside a component: drop the cache, re-fetch,
 * and notify every subscribed hook via the settings-refresh bus.
 */
export async function refreshApiKeyStatus(
    adapter: AiKeyStoreAdapter,
    registry: ProviderRegistry,
    userId: string | null,
): Promise<void> {
    if (!userId) return;
    CACHE.delete(userId);
    INFLIGHT.delete(userId);
    await fetchSnapshot(adapter, registry, userId);
    emitSettingsRefresh();
}

/** Test-only: drop the module-level cache between tests. */
export function _resetApiKeyStatusCacheForTests(): void {
    CACHE.clear();
    INFLIGHT.clear();
}

export function useApiKeyStatus(): ApiKeyStatus {
    const { adapter, registry, userId } = useAiSettingsContext();
    const [snapshot, setSnapshot] = useState<Snapshot>(
        () => (userId ? CACHE.get(userId) : undefined) ?? NOT_READY,
    );

    useEffect(() => {
        if (!userId) {
            setSnapshot(NOT_READY);
            return;
        }
        let alive = true;
        const apply = (snap: Snapshot) => {
            if (alive) setSnapshot(snap);
        };
        const cached = CACHE.get(userId);
        if (cached) apply(cached);
        else void fetchSnapshot(adapter, registry, userId).then(apply);

        const unsubscribe = subscribeSettingsRefresh(() => {
            const fresh = CACHE.get(userId);
            if (fresh) apply(fresh);
            else void fetchSnapshot(adapter, registry, userId).then(apply);
        });
        return () => {
            alive = false;
            unsubscribe();
        };
    }, [adapter, registry, userId]);

    const refresh = useCallback(async () => {
        await refreshApiKeyStatus(adapter, registry, userId);
    }, [adapter, registry, userId]);

    return {
        ready: snapshot.ready,
        hasKey: snapshot.hasKey,
        activeProvider: snapshot.activeProvider,
        refresh,
    };
}
