# @astrapi69/ai-key-vault-react

React UI for **bring-your-own-key (BYOK) AI provider settings** and the
encrypted key vault. Built on
[`@astrapi69/ai-key-vault`](https://www.npmjs.com/package/@astrapi69/ai-key-vault);
extracted from
[adaptive-learner](https://github.com/astrapi69/adaptive-learner).

The components import no storage, i18n framework, router or toast library.
Everything app-specific is injected once, at the provider.

## Setup

```tsx
import {
    BUILTIN_REGISTRY,
    createProviderRegistry,
    BUILTIN_PROVIDERS,
} from "@astrapi69/ai-key-vault";
import {
    AiSettingsProvider,
    AiSettingsPanel,
    KeyVaultSection,
    ApiKeyRequiredNotice,
    useApiKeyStatus,
} from "@astrapi69/ai-key-vault-react";

<AiSettingsProvider
    adapter={myKeyStoreAdapter}   // implements AiKeyStoreAdapter over your storage
    registry={BUILTIN_REGISTRY}   // or createProviderRegistry([...])
    userId={currentUserId}
    t={myI18n.t}                  // (key, fallback) => string; optional
    notify={myToasts}             // { success, error, warning }; optional
    confirm={myConfirmDialog}     // (opts) => Promise<boolean>; optional
    Button={MyButton}             // design-system slots; optional (plain defaults otherwise)
    Input={MyInput}
    Link={MyRouterLink}           // { to } => element; default <a href>
>
    <AiSettingsPanel />
    <KeyVaultSection />
</AiSettingsProvider>;
```

Everything except `adapter`, `registry` and `userId` has a default, so the
UI renders with zero wiring and adopts your look/behaviour as you override
slots.

### Styling the native file-picker button

`KeyVaultImportForm`'s file input is plain native HTML (no slot for it -
there's no sane way to inject a whole `<input type="file">` replacement), so
it renders as unstyled OS chrome by default, same as any bare file input. It
carries a stable class, `akv-file-input`, so a host can style the native
button from its OWN stylesheet without depending on an undocumented
`data-testid`:

```css
.akv-file-input::file-selector-button {
    /* also add ::-webkit-file-upload-button for older Safari/Chrome */
    cursor: pointer;
    border: 0;
    border-radius: 0.375rem;
    padding: 0.5rem 1rem;
    background: var(--your-accent-token);
    color: var(--your-accent-fg-token);
}
```

The kit ships no rule of its own for it - consistent with the slot
philosophy above, appearance is entirely the host's call.

## What you get

- **`AiSettingsPanel`** — provider overview, active-provider select,
  per-provider model overrides, and the API-key manager (save / live-test /
  delete, with the auto-test-on-save last-known-good backup flow).
- **`KeyVaultSection`** + **`KeyVaultImportForm`** — passphrase-encrypted
  export/import of the keys, capability-aware (server-managed keys show a
  notice instead of a dead export form; import always works).
- **`ConfiguredProvidersTable`**, **`ApiKeyRow`**, **`ApiKeyRequiredNotice`**,
  **`SecretInput`** — the building blocks, usable on their own.
- **`useAiKeyStore`** / **`useApiKeyStatus`** — the state + gating hooks.

## Capabilities

Optional adapter methods (`testApiKey`, `backupApiKey`,
`getApiKeyBackup`, `restoreApiKeyBackup`) are surfaced as capabilities; the
UI shows the Test button and the restore link only when the adapter
implements them.

## Peer dependency

`react ^18 || ^19`.

## License

MIT
