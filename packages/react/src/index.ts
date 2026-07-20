// Provider + context
export { AiSettingsProvider } from "./provider";
export type { AiSettingsProviderProps } from "./provider";
export { useAiSettingsContext } from "./context";
export type {
    AiSettingsContextValue,
    ModelPickerSlot,
    ModelPickerSlotProps,
    ProviderIcon,
} from "./context";

// Slots
export {
    DefaultButton,
    DefaultInput,
    DefaultLink,
    defaultConfirm,
    defaultNotify,
} from "./slots";
export type {
    ButtonSize,
    ButtonSlot,
    ButtonSlotProps,
    ButtonVariant,
    ConfirmFn,
    ConfirmOptions,
    InputSlot,
    InputSlotProps,
    LinkSlot,
    LinkSlotProps,
    NotifyApi,
} from "./slots";

// Hooks
export { useApiKeyStatus, refreshApiKeyStatus } from "./hooks/useApiKeyStatus";
export type { ApiKeyStatus } from "./hooks/useApiKeyStatus";
export { useAiKeyStore } from "./hooks/useAiKeyStore";
export type { UseAiKeyStoreResult } from "./hooks/useAiKeyStore";

// Components
export { SecretInput } from "./SecretInput";
export type { SecretInputProps } from "./SecretInput";
export { ApiKeyRequiredNotice } from "./components/ApiKeyRequiredNotice";
export type { ApiKeyRequiredNoticeProps } from "./components/ApiKeyRequiredNotice";
export { ApiKeyRow } from "./components/ApiKeyRow";
export type { ApiKeyRowProps } from "./components/ApiKeyRow";
export { ConfiguredProvidersTable } from "./components/ConfiguredProvidersTable";
export type { ConfiguredProvidersTableProps } from "./components/ConfiguredProvidersTable";
export { KeyVaultImportForm } from "./components/KeyVaultImportForm";
export type { KeyVaultImportFormProps } from "./components/KeyVaultImportForm";
export { KeyVaultSection } from "./components/KeyVaultSection";
export { AiSettingsPanel } from "./components/AiSettingsPanel";
export type { AiSettingsPanelProps } from "./components/AiSettingsPanel";
