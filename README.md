# ai-key-vault

Reusable building blocks for **bring-your-own-key (BYOK) AI provider
settings**: passphrase-encrypted key export/import, a generic provider
registry, storage-agnostic settings adapters, and browser-direct provider
clients. Extracted from
[adaptive-learner](https://github.com/astrapi69/adaptive-learner), where this
stack had been rebuilt several times across projects.

## Packages

| Package | Purpose |
|---|---|
| [`@astrapi69/passphrase-vault`](packages/passphrase-vault) | Zero-dependency passphrase-based authenticated encryption of a small JSON value (WebCrypto PBKDF2 + AES-GCM). Usable on its own, e.g. for any local-first app that needs an encrypted export file. |
| [`@astrapi69/ai-key-vault`](packages/core) | Core: provider registry, `AiKeyStoreAdapter` storage interface, key vault payload + import/export orchestration, browser-direct chat clients (anthropic/openai/gemini, incl. SSE streaming), model discovery, key format validation, status classification, secret masking. Framework-free. |
| [`@astrapi69/ai-key-vault-react`](packages/react) | React UI layer: an `AiSettingsProvider` plus the settings panel, provider table, API-key rows, the key vault import/export components, and the `useAiKeyStore` / `useApiKeyStatus` hooks. Storage-, i18n- and UI-slot-injectable. |

## Design principles

- **Storage-agnostic.** The core never touches IndexedDB, localStorage or a
  backend. Consumers implement `AiKeyStoreAdapter` over their own
  persistence (adaptive-learner: one thin adapter over its dual
  API/Dexie storage; other apps: whatever they use).
- **Provider-generic.** Providers are descriptor objects
  (`AiProviderDescriptor`), not a hardcoded union. The registry API is
  validated against a six-provider consumer (anthropic, openai, gemini,
  mistral, LM Studio, custom base URL); the built-in clients cover
  anthropic/openai/gemini protocols.
- **i18n-injectable.** No i18n framework dependency. UI-facing strings are
  English fallbacks; consumers pass a `t(key, fallback)` function.
- **Keys as parameters.** The chat/discovery clients receive the API key as
  a call parameter and never read storage themselves.

## Development

```bash
make install
make test           # vitest
make release-check  # lint + typecheck + test + build
make publish-dry    # npm publish --dry-run for both packages
```

Publishing is manual and gated on `release-check` (`make publish`).
Consumers pin **exact** versions (this is crypto-adjacent code; no silent
drift).

## License

MIT
