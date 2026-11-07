export {
    DEFAULT_VAULT_FORMAT,
    VaultDecryptError,
    decryptAndUpgradeVault,
    decryptFromVault,
    encryptToVault,
    looksLikeVaultEnvelope,
} from "./passphrase-vault";
export type {
    VaultEnvelope,
    VaultFormatOptions,
    VaultUnlockResult,
} from "./passphrase-vault";
