/**
 * AiSettingsContext — the single dependency-injection seam for the React UI.
 *
 * The host supplies everything app-specific once, at the provider: the
 * storage adapter, the provider registry, the active user id, a translate
 * function, a notify/confirm surface, and the UI slots. Every component and
 * hook reads from here — none of them import storage, i18n, a router or a
 * toast library directly.
 */

import { createContext, useContext } from "react";
import type {
    AiKeyStoreAdapter,
    ProviderRegistry,
    Translate,
} from "@astrapi69/ai-key-vault";

import type {
    ButtonSlot,
    ConfirmFn,
    InputSlot,
    LinkSlot,
    NotifyApi,
} from "./slots";
import type { ComponentType } from "react";

/** Optional per-provider decorative icon component. */
export type ProviderIcon = ComponentType<{ className?: string }>;

/**
 * Optional model-picker slot. When a host provides one (e.g. with live model
 * discovery), the settings panel renders it for the model-override field;
 * otherwise a plain input with the descriptor's recommended models as
 * datalist suggestions is used.
 */
export interface ModelPickerSlotProps<P extends string = string> {
    userId: string;
    provider: P;
    /** The persisted override value. */
    value: string;
    /** The in-flight draft value. */
    draft: string;
    onDraftChange: (next: string) => void;
    defaultModel: string;
    hasApiKey: boolean;
    disabled?: boolean;
}
export type ModelPickerSlot<P extends string = string> = ComponentType<
    ModelPickerSlotProps<P>
>;

export interface AiSettingsContextValue<P extends string = string> {
    adapter: AiKeyStoreAdapter<P>;
    registry: ProviderRegistry<P>;
    /** Active user id, or null when nobody is signed in (UI degrades). */
    userId: string | null;
    /** Translate with an English fallback: `t(key, fallback)`. */
    t: Translate;
    notify: NotifyApi;
    confirm: ConfirmFn;
    /** Envelope format string for the encrypted key vault. Defaults to the
     *  passphrase-vault default when omitted. */
    vaultFormat?: string;
    /** True when the app runs browser-direct (no backend proxy). Drives the
     *  desktop-only provider status. Defaults to
     *  `adapter.capabilities.clientReadableKeys`. */
    browserRuntime: boolean;
    // UI slots
    Button: ButtonSlot;
    Input: InputSlot;
    Link: LinkSlot;
    providerIcons?: Partial<Record<P, ProviderIcon>>;
    ModelPicker?: ModelPickerSlot<P>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AiSettingsContext = createContext<AiSettingsContextValue<any> | null>(
    null,
);

/**
 * Read the AI-settings context. Throws when used outside
 * {@link AiSettingsProvider} so a missing provider fails loudly at mount
 * instead of silently rendering broken UI.
 */
export function useAiSettingsContext<
    P extends string = string,
>(): AiSettingsContextValue<P> {
    const ctx = useContext(AiSettingsContext);
    if (ctx === null) {
        throw new Error(
            "useAiSettingsContext must be used within an <AiSettingsProvider>",
        );
    }
    return ctx as AiSettingsContextValue<P>;
}
