# Changelog

All notable changes to the packages in this repository are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
packages follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-08-08

### Changed

- **Cross-app key portability.** `@astrapi69/ai-key-vault` 0.2.0 /
  `@astrapi69/ai-key-vault-react` 0.3.0:
  `importEncryptedKeyVault` (and the React `KeyVaultImportForm`) is now
  **format-agnostic**: it decrypts with the format the FILE itself declares
  instead of the host app's own label, so a user can import a sibling app's
  `.alk` export without it being rejected as a "foreign file". The security
  boundary is unchanged - the passphrase plus the AES-GCM authentication tag;
  a wrong passphrase or a tampered file still fails to decrypt.

### Added

- `@astrapi69/ai-key-vault`: `providerAliases` option on import (and
  `importProviderAliases` on the React `AiSettingsProvider`) maps a source
  app's provider ids onto the host's (e.g. `{ gemini: "google" }`), so keys
  land on the right provider when two apps name it differently. An id that is
  neither known nor aliased still rejects the payload, preserving the
  foreign-file protection. `normalizeKeyVaultPayload` gained the same
  `aliases` option.
- `@astrapi69/ai-key-vault`: `PERPLEXITY_PROVIDER`, a ready OpenAI-compatible
  provider descriptor apps can spread into their registry
  (`createProviderRegistry([...BUILTIN_PROVIDERS, PERPLEXITY_PROVIDER])`).
  Deliberately NOT in the browser-direct `BUILTIN_PROVIDERS` trio: Perplexity
  has no browser-direct CORS opt-in, so it is `corsBlocked` and must be routed
  through a backend proxy (base URL `https://api.perplexity.ai`).

## [0.2.2] - 2026-08-08

### Added

- `@astrapi69/ai-key-vault-react` 0.2.0: `KeyVaultImportForm`'s `onImported`
  callback now receives the `KeyVaultImportResult` (`{ providers }`) from the
  core import, so a host can report which providers received a key
  (e.g. "2 keys imported") instead of a bare "something happened". A
  no-argument handler stays valid, so existing callers (including
  `KeyVaultSection`) are unaffected.
- Example: `packages/react/src/examples/KeyVaultRoundTripExample.tsx` (+ test)
  demonstrates the full encrypted EXPORT -> IMPORT round trip between two
  in-memory "devices" using only the public API, including the smallest
  `AiKeyStoreAdapter` a host has to implement. Dev-only living documentation
  (tsup bundles only `index.ts`, so it is not part of the published entry).

## [0.2.1] - 2026-07-20

### Fixed

- `@astrapi69/ai-key-vault-react` 0.1.1: `useAiKeyStore` now subscribes to
  the shared settings-refresh bus and re-reads its snapshot on emit, so the
  settings panel reflects an out-of-band change (an encrypted key-vault
  import elsewhere in the tree, or a backup restore) WITHOUT a reload
  (#1836). Previously the panel kept showing the pre-import snapshot until it
  remounted. Caught by the adaptive-learner Stage-3 device verification
  (export → delete → paste-import round-trip).

## [0.2.0] - 2026-07-20

### Added

- `@astrapi69/ai-key-vault-react` 0.1.0: the React UI layer. An
  `AiSettingsProvider` injects the storage adapter, provider registry,
  active user id, a `t(key, fallback)` translate function, a notify/confirm
  surface, and UI slots (Button, Input, Link, optional per-provider icons and
  a ModelPicker) — the components import no storage, i18n, router or toast
  library directly. Ships `AiSettingsPanel`, `ApiKeyRow`,
  `ConfiguredProvidersTable`, `ApiKeyRequiredNotice`, `KeyVaultSection`,
  `KeyVaultImportForm`, `SecretInput`, plus the `useAiKeyStore` and
  `useApiKeyStatus` hooks. Optional adapter capabilities (test / backup)
  gate the corresponding affordances. Extracted from adaptive-learner.

## [0.1.0] - 2026-07-20

### Added

- `@astrapi69/passphrase-vault` 0.1.0: passphrase-based authenticated
  encryption of a small JSON value (WebCrypto only: PBKDF2-HMAC-SHA-256,
  250k iterations, AES-GCM-256). Extracted from adaptive-learner
  (`lib/crypto/passphrase-vault.ts`, EXP-038). The envelope `format`
  string is now configurable per app; the default stays
  `"adaptive-learner-keys"` so existing `.alk` files keep importing.
- `@astrapi69/ai-key-vault` 0.1.0 (core): generic AI provider registry
  (`AiProviderDescriptor`, validated against bibliogon's six-provider
  needs incl. custom base URLs), the `AiKeyStoreAdapter` storage
  interface with optional test/backup capabilities, key vault
  payload + import/export orchestration (with legacy adaptive-learner
  payload normalization), browser-direct chat clients for
  anthropic/openai/gemini incl. SSE streaming, browser-direct model
  discovery with sessionStorage caching, API key format validation,
  provider key status classification, secret masking, model
  partitioning, and a settings refresh bus. Extracted from
  adaptive-learner.
