/**
 * settings-refresh-bus — a minimal module-level pub/sub so any part of an app
 * that mutates the persisted AI settings (encrypted key-vault import, backup
 * restore) can ask live views of those settings to RE-READ them, without a
 * page reload.
 *
 * Module singleton + listener set. Carries no payload: the subscriber owns
 * the re-fetch, so nothing here ever touches key material.
 */

const listeners = new Set<() => void>();

/**
 * Subscribe to settings-refresh requests. Returns an unsubscribe function.
 *
 * @example
 * useEffect(() => subscribeSettingsRefresh(refetchSettings), []);
 */
export function subscribeSettingsRefresh(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Signal that the persisted AI settings changed and any live view of them
 * should re-read from storage. Call after a successful key-vault import or a
 * backup restore.
 */
export function emitSettingsRefresh(): void {
    for (const listener of [...listeners]) listener();
}

/** Clear all listeners — TEST ONLY. */
export function resetSettingsRefreshBus(): void {
    listeners.clear();
}
