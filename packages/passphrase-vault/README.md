# @astrapi69/passphrase-vault

Passphrase-based, authenticated encryption of a small JSON value using
**WebCrypto only** — no dependencies, no self-built crypto.

- Key derivation: PBKDF2-HMAC-SHA-256, 250,000 iterations, 16-byte random salt
- Encryption: AES-GCM-256, 12-byte random IV (authenticated — a wrong
  passphrase or a tampered byte rejects; no partial decrypts)
- Envelope: a pretty-printed JSON string carrying format, version, KDF
  parameters, IV and ciphertext — self-contained, safe to write to a file

Extracted from [adaptive-learner](https://github.com/astrapi69/adaptive-learner)
(EXP-038, the encrypted `.alk` AI-key export).

## Usage

```ts
import {
    encryptToVault,
    decryptFromVault,
    looksLikeVaultEnvelope,
    VaultDecryptError,
} from "@astrapi69/passphrase-vault";

// Encrypt any JSON-serialisable value:
const envelope = await encryptToVault({ token: "secret" }, passphrase, {
    format: "my-app-vault",
});
// -> write `envelope` (a JSON string) to a file

// Gate an import UI without decrypting:
looksLikeVaultEnvelope(fileText, { format: "my-app-vault" }); // boolean

// Decrypt:
try {
    const value = await decryptFromVault<{ token: string }>(fileText, passphrase, {
        format: "my-app-vault",
    });
} catch (err) {
    if (err instanceof VaultDecryptError) {
        // wrong passphrase, foreign/malformed file, or tampered content —
        // deliberately indistinguishable
    }
}
```

The `format` option identifies your application's envelope. Omitting it uses
`"adaptive-learner-keys"` (the historical default, kept so pre-extraction
`.alk` files keep importing). An envelope whose format does not match the
expected one is rejected with `VaultDecryptError`.

## License

MIT
