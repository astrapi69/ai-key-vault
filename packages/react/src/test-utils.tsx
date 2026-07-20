/**
 * Shared test helpers (NOT part of the published entry — tsup only bundles
 * index.ts): an in-memory mock `AiKeyStoreAdapter` and a provider wrapper.
 */

import type { ReactNode } from "react";
import {
    BUILTIN_REGISTRY,
    type AiKeyStoreAdapter,
    type AiSettingsSnapshot,
    type ApiKeyTestResult,
    type BuiltinProviderId,
    type KeySource,
} from "@astrapi69/ai-key-vault";

import { AiSettingsProvider } from "./provider";
import type { NotifyApi } from "./slots";

export const TEST_IDS: readonly BuiltinProviderId[] = BUILTIN_REGISTRY.ids;

export interface MockAdapterState {
    keys: Partial<Record<BuiltinProviderId, string>>;
    activeProvider: BuiltinProviderId | null;
    modelOverride: Partial<Record<BuiltinProviderId, string | null>>;
    backups: Partial<Record<BuiltinProviderId, string>>;
    patchCalls: number;
}

export interface MockAdapterOptions {
    clientReadableKeys?: boolean;
    keyBackup?: boolean;
    liveTest?: boolean;
    initialKeys?: Partial<Record<BuiltinProviderId, string>>;
    initialActive?: BuiltinProviderId | null;
    /** A key is "valid" iff it starts with this prefix (default "good"). */
    validPrefix?: string;
}

export function makeMockAdapter(options: MockAdapterOptions = {}): {
    adapter: AiKeyStoreAdapter<BuiltinProviderId>;
    state: MockAdapterState;
} {
    const validPrefix = options.validPrefix ?? "good";
    const state: MockAdapterState = {
        keys: { ...options.initialKeys },
        activeProvider: options.initialActive ?? null,
        modelOverride: {},
        backups: {},
        patchCalls: 0,
    };

    const snapshot = (): AiSettingsSnapshot<BuiltinProviderId> => {
        const hasKey = {} as Record<BuiltinProviderId, boolean>;
        const keySource = {} as Record<BuiltinProviderId, KeySource>;
        for (const id of TEST_IDS) {
            hasKey[id] = Boolean(state.keys[id]);
            keySource[id] = state.keys[id] ? "settings" : "none";
        }
        return {
            activeProvider: state.activeProvider,
            hasKey,
            keySource,
            keyPreview: {},
            modelOverride: { ...state.modelOverride },
        };
    };

    const base: AiKeyStoreAdapter<BuiltinProviderId> = {
        capabilities: {
            clientReadableKeys: options.clientReadableKeys ?? true,
            keyBackup: options.keyBackup ?? true,
            liveTest: options.liveTest ?? true,
        },
        getSettings: async () => snapshot(),
        patchSettings: async (_userId, patch) => {
            state.patchCalls += 1;
            if ("activeProvider" in patch) state.activeProvider = patch.activeProvider ?? null;
            if (patch.modelOverride) {
                state.modelOverride = { ...state.modelOverride, ...patch.modelOverride };
            }
            return snapshot();
        },
        setApiKey: async (_userId, provider, key) => {
            state.keys[provider] = key;
            return snapshot();
        },
        deleteApiKey: async (_userId, provider) => {
            delete state.keys[provider];
            return snapshot();
        },
        exportApiKeys: async () =>
            (options.clientReadableKeys ?? true) ? { ...state.keys } : {},
    };

    if (options.liveTest ?? true) {
        base.testApiKey = async (_userId, provider, draftKey): Promise<ApiKeyTestResult> => {
            const key = draftKey ?? state.keys[provider];
            if (!key) return { success: false, kind: "no_key" };
            return key.startsWith(validPrefix)
                ? { success: true, kind: "ok" }
                : { success: false, kind: "invalid" };
        };
    }
    if (options.keyBackup ?? true) {
        base.backupApiKey = async (_userId, provider, key) => {
            state.backups[provider] = key;
        };
        base.getApiKeyBackup = async (_userId, provider) => ({
            has: Boolean(state.backups[provider]),
            testedAt: null,
        });
        base.restoreApiKeyBackup = async (_userId, provider) => {
            const backup = state.backups[provider];
            if (backup) state.keys[provider] = backup;
            return snapshot();
        };
    }

    return { adapter: base, state };
}

export function collectNotify(): NotifyApi & { messages: string[] } {
    const messages: string[] = [];
    return {
        messages,
        success: (m) => messages.push(`success:${m}`),
        error: (m) => messages.push(`error:${m}`),
        warning: (m) => messages.push(`warning:${m}`),
    };
}

export interface WrapperOptions {
    adapter: AiKeyStoreAdapter<BuiltinProviderId>;
    userId?: string | null;
    notify?: NotifyApi;
    confirm?: () => boolean;
    vaultFormat?: string;
    browserRuntime?: boolean;
}

export function makeWrapper(opts: WrapperOptions) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <AiSettingsProvider
                adapter={opts.adapter}
                registry={BUILTIN_REGISTRY}
                userId={opts.userId ?? "u1"}
                notify={opts.notify}
                confirm={opts.confirm ?? (() => true)}
                vaultFormat={opts.vaultFormat}
                browserRuntime={opts.browserRuntime}
            >
                {children}
            </AiSettingsProvider>
        );
    };
}
