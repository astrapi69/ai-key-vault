/**
 * AiSettingsProvider — wraps the AI-settings UI and supplies the injected
 * dependencies once. Only `adapter` and `registry` are required; everything
 * else has a sensible default (plain UI slots, console notify, window
 * confirm), so the components render with zero host wiring and get their
 * look/behaviour from whatever the host chooses to override.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import type {
    AiKeyStoreAdapter,
    ProviderRegistry,
    Translate,
} from "@astrapi69/ai-key-vault";

import {
    AiSettingsContext,
    type AiSettingsContextValue,
    type ModelPickerSlot,
    type ProviderIcon,
} from "./context";
import {
    DefaultButton,
    DefaultInput,
    DefaultLink,
    defaultConfirm,
    defaultNotify,
    type ButtonSlot,
    type ConfirmFn,
    type InputSlot,
    type LinkSlot,
    type NotifyApi,
} from "./slots";

const identityTranslate: Translate = (_key, fallback) => fallback ?? _key;

export interface AiSettingsProviderProps<P extends string = string> {
    adapter: AiKeyStoreAdapter<P>;
    registry: ProviderRegistry<P>;
    userId: string | null;
    children: ReactNode;
    t?: Translate;
    notify?: NotifyApi;
    confirm?: ConfirmFn;
    vaultFormat?: string;
    browserRuntime?: boolean;
    Button?: ButtonSlot;
    Input?: InputSlot;
    Link?: LinkSlot;
    providerIcons?: Partial<Record<P, ProviderIcon>>;
    ModelPicker?: ModelPickerSlot<P>;
}

/** Provide the AI-settings dependencies to the component tree. */
export function AiSettingsProvider<P extends string = string>({
    adapter,
    registry,
    userId,
    children,
    t = identityTranslate,
    notify = defaultNotify,
    confirm = defaultConfirm,
    vaultFormat,
    browserRuntime,
    Button = DefaultButton,
    Input = DefaultInput,
    Link = DefaultLink,
    providerIcons,
    ModelPicker,
}: AiSettingsProviderProps<P>) {
    const value = useMemo<AiSettingsContextValue<P>>(
        () => ({
            adapter,
            registry,
            userId,
            t,
            notify,
            confirm,
            vaultFormat,
            browserRuntime: browserRuntime ?? adapter.capabilities.clientReadableKeys,
            Button,
            Input,
            Link,
            providerIcons,
            ModelPicker,
        }),
        [
            adapter,
            registry,
            userId,
            t,
            notify,
            confirm,
            vaultFormat,
            browserRuntime,
            Button,
            Input,
            Link,
            providerIcons,
            ModelPicker,
        ],
    );
    return (
        <AiSettingsContext.Provider value={value}>
            {children}
        </AiSettingsContext.Provider>
    );
}
