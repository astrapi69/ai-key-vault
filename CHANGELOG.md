# Changelog

All notable changes to the packages in this repository are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
packages follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
