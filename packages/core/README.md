# @astrapi69/ai-key-vault

Storage-agnostic core for **bring-your-own-key (BYOK) AI provider
settings**: a generic provider registry, a storage adapter contract, a
passphrase-encrypted key vault, browser-direct chat clients with SSE
streaming, and model discovery. Extracted from
[adaptive-learner](https://github.com/astrapi69/adaptive-learner).

No React, no i18n framework, no storage engine — those are seams the
consuming app fills.

## Concepts

### Provider registry

Providers are data, not a hardcoded union:

```ts
import { BUILTIN_PROVIDERS, createProviderRegistry } from "@astrapi69/ai-key-vault";

const registry = createProviderRegistry([
    ...BUILTIN_PROVIDERS, // anthropic, openai, gemini incl. key format rules
    {
        id: "lmstudio",
        label: "LM Studio",
        keyFormat: { minLength: 0 },
        defaultModel: "local-model",
        baseUrl: "http://localhost:1234/v1",
        requiresApiKey: false,
        desktopOnly: true,
    },
]);
```

### Storage adapter

The kit never touches persistence. Implement `AiKeyStoreAdapter` over your
app's storage and pass it in. Optional methods (`testApiKey`,
`backupApiKey`, ...) are capabilities, reported via `capabilities` so a UI
can hide affordances your storage cannot serve.

### Encrypted key vault

```ts
import { buildEncryptedKeyVault, importEncryptedKeyVault } from "@astrapi69/ai-key-vault";

const envelope = await buildEncryptedKeyVault(adapter, userId, passphrase, {
    providerIds: registry.ids,
});
// ... user stores the file; later, possibly on another device:
await importEncryptedKeyVault(adapter, userId, fileText, passphrase, {
    providerIds: registry.ids,
});
```

Crypto lives in [`@astrapi69/passphrase-vault`](../passphrase-vault)
(PBKDF2 + AES-GCM, WebCrypto only) and is re-exported here. Legacy
adaptive-learner `.alk` payloads import unchanged.

### Browser-direct clients

```ts
import { aiComplete, aiStream } from "@astrapi69/ai-key-vault";

const text = await aiComplete({
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    apiKey, // always a parameter — the clients never read storage
    messages: [{ role: "user", content: "Hi" }],
});
```

`aiStream` delivers SSE deltas via an `onChunk` callback; all three
built-in providers are normalized to one wire-reading path. Failures throw
`AiProviderError` (status + provider id + detail).

### i18n

UI-facing helpers take a `t(key, fallback)` function
(`Translate`). English fallbacks are built in; catalogs stay in the app.

## License

MIT
