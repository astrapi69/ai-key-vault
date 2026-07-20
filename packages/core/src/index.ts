// Crypto (re-exported for convenience — consumers of the core do not need
// a second direct dependency for the common case).
export {
    DEFAULT_VAULT_FORMAT,
    VaultDecryptError,
    decryptFromVault,
    encryptToVault,
    looksLikeVaultEnvelope,
} from "@astrapi69/passphrase-vault";
export type { VaultEnvelope, VaultFormatOptions } from "@astrapi69/passphrase-vault";

// Provider registry
export {
    BUILTIN_PROVIDERS,
    BUILTIN_REGISTRY,
    DEFAULT_MODELS,
    createProviderRegistry,
    providerRequiresApiKey,
    resolveModel,
} from "./providers/registry";
export type {
    AiProviderDescriptor,
    BuiltinProviderId,
    KeyFormatRule,
    ProviderRegistry,
} from "./providers/registry";

// Provider helpers
export { isValidApiKeyFormat } from "./providers/key-format";
export { providerKeyStatus } from "./providers/status";
export type { ProviderKeyStatus, ProviderKeyStatusInput } from "./providers/status";
export { maskSecret } from "./providers/mask-secret";
export { partitionModels } from "./providers/partition-models";
export type { ModelLike, PartitionedModels } from "./providers/partition-models";

// Storage adapter contract
export type {
    AiKeyStoreAdapter,
    AiKeyStoreCapabilities,
    AiSettingsSnapshot,
    ApiKeyBackupInfo,
    ApiKeyTestKind,
    ApiKeyTestResult,
    KeySource,
} from "./storage/adapter";

// Key vault payload + io
export {
    KEY_VAULT_EXTENSION,
    buildKeyVaultPayload,
    hasExportableKey,
    normalizeKeyVaultPayload,
    presentKeys,
} from "./vault/payload";
export type {
    KeyVaultPayload,
    KeyVaultProviderSettings,
    RawApiKeys,
} from "./vault/payload";
export { buildEncryptedKeyVault, importEncryptedKeyVault } from "./vault/io";
export type { KeyVaultImportResult, KeyVaultIoOptions } from "./vault/io";

// Browser-direct clients
export { AiProviderError } from "./clients/errors";
export { aiComplete, aiCompleteWithMeta, aiStream } from "./clients/chat";
export type { AiCompleteOptions, AiStreamOptions } from "./clients/chat";
export {
    clearModelCache,
    fetchAnthropicModels,
    fetchAvailableModels,
    fetchGeminiModels,
    fetchOpenAiModels,
} from "./clients/model-discovery";
export type {
    AiCompletion,
    AiProviderClient,
    ChatMessage,
    ModelInfo,
    ProviderCallOptions,
} from "./clients/types";

// Reactivity
export {
    emitSettingsRefresh,
    resetSettingsRefreshBus,
    subscribeSettingsRefresh,
} from "./bus/refresh-bus";

// i18n seam
export type { Translate } from "./i18n/translate";
