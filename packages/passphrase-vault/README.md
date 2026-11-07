# @astrapi69/passphrase-vault

Passphrase-based, authenticated encryption of a small JSON value using
**WebCrypto only** — no dependencies, no self-built crypto.

- Key derivation: PBKDF2-HMAC-SHA-256, 600,000 iterations for new envelopes
  (the [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2)
  figure), 16-byte random salt. The count is stored per envelope and
  decryption uses the stored count, so envelopes written with 250,000 by
  0.1.1 and earlier keep opening
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

## Upgrading a stored vault on unlock

When you keep an envelope at rest (for example in `localStorage`) and unlock
it with the user's passphrase, use `decryptAndUpgradeVault` instead of
`decryptFromVault`. It returns the value and, when the stored envelope was
written with fewer iterations than new envelopes use, an upgraded envelope
(same passphrase, same format, fresh salt and IV) to write over the stored
copy. A wrong passphrase throws `VaultDecryptError` and returns nothing, so
the stored copy stays untouched.

```ts
import { decryptAndUpgradeVault } from "@astrapi69/passphrase-vault";

const { value, upgradedEnvelope } = await decryptAndUpgradeVault<MyVault>(
    stored,
    passphrase,
    { format: "my-app-vault" },
);
if (upgradedEnvelope !== null) saveEnvelope(upgradedEnvelope);
```

A file the user exported earlier cannot be rewritten in place; exporting it
again writes the current count.

## License

MIT
