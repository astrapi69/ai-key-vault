/**
 * KeyVaultRoundTripExample — a runnable, self-contained example that
 * demonstrates the encrypted AI-key EXPORT -> IMPORT round trip between two
 * "devices", using only the public package API.
 *
 * Device A already holds some keys. You choose a passphrase and export an
 * encrypted envelope. Device B is a fresh install with no keys: paste the
 * envelope (or the example wires it for you), enter the same passphrase, and
 * import — the keys land on Device B, encrypted end to end, never in plaintext
 * on disk. The imported-provider list is read from the new
 * ``KeyVaultImportForm`` ``onImported(result)`` callback.
 *
 * The in-memory ``AiKeyStoreAdapter`` below is intentionally tiny: it is the
 * smallest thing a host has to implement to wire the settings UI. Real apps
 * back this with their own storage (a passphrase-encrypted browser vault, a
 * backend config chain, etc.).
 *
 * Not part of the published entry (tsup bundles only ``index.ts``); it lives
 * here as living documentation and is exercised by
 * ``KeyVaultRoundTripExample.test.tsx``.
 */

import { useMemo, useState } from "react";
import {
    BUILTIN_REGISTRY,
    buildEncryptedKeyVault,
    type AiKeyStoreAdapter,
    type AiSettingsSnapshot,
    type BuiltinProviderId,
    type KeySource,
    type KeyVaultImportResult,
} from "@astrapi69/ai-key-vault";

import { AiSettingsProvider } from "../provider";
import { KeyVaultImportForm } from "../components/KeyVaultImportForm";

const IDS = BUILTIN_REGISTRY.ids;
const USER = "example-user";
/** A distinct envelope format so a foreign file is rejected on import. */
const VAULT_FORMAT = "example-ai-keys";
const MIN_PASSPHRASE = 8;

/**
 * The smallest adapter that satisfies the settings UI: keys + active provider
 * + model overrides held in memory. This is the wiring seam a host fills in.
 */
export function makeMemoryAdapter(
    initialKeys: Partial<Record<BuiltinProviderId, string>> = {},
): AiKeyStoreAdapter<BuiltinProviderId> {
    const keys: Partial<Record<BuiltinProviderId, string>> = { ...initialKeys };
    const models: Partial<Record<BuiltinProviderId, string | null>> = {};
    let activeProvider: BuiltinProviderId | null =
        (Object.keys(initialKeys)[0] as BuiltinProviderId | undefined) ?? null;

    const snapshot = (): AiSettingsSnapshot<BuiltinProviderId> => {
        const hasKey = {} as Record<BuiltinProviderId, boolean>;
        const keySource = {} as Record<BuiltinProviderId, KeySource>;
        for (const id of IDS) {
            hasKey[id] = Boolean(keys[id]);
            keySource[id] = keys[id] ? "settings" : "none";
        }
        return {
            activeProvider,
            hasKey,
            keySource,
            keyPreview: {},
            modelOverride: { ...models },
        };
    };

    return {
        capabilities: { clientReadableKeys: true, keyBackup: false, liveTest: false },
        getSettings: async () => snapshot(),
        patchSettings: async (_userId, patch) => {
            if ("activeProvider" in patch) activeProvider = patch.activeProvider ?? null;
            if (patch.modelOverride) Object.assign(models, patch.modelOverride);
            return snapshot();
        },
        setApiKey: async (_userId, provider, key) => {
            keys[provider] = key;
            return snapshot();
        },
        deleteApiKey: async (_userId, provider) => {
            delete keys[provider];
            return snapshot();
        },
        exportApiKeys: async () => ({ ...keys }),
    };
}

export interface KeyVaultRoundTripExampleProps {
    /** Device that already holds keys (defaults to a seeded in-memory one). */
    deviceA?: AiKeyStoreAdapter<BuiltinProviderId>;
    /** Fresh device that receives the imported keys (defaults to empty). */
    deviceB?: AiKeyStoreAdapter<BuiltinProviderId>;
}

export function KeyVaultRoundTripExample({
    deviceA: injectedA,
    deviceB: injectedB,
}: KeyVaultRoundTripExampleProps = {}) {
    const deviceA = useMemo(
        () =>
            injectedA ??
            makeMemoryAdapter({ anthropic: "sk-ant-demo-key", openai: "sk-demo-openai" }),
        [injectedA],
    );
    const deviceB = useMemo(() => injectedB ?? makeMemoryAdapter(), [injectedB]);

    const [passphrase, setPassphrase] = useState("");
    const [envelope, setEnvelope] = useState("");
    const [exportError, setExportError] = useState("");
    const [imported, setImported] = useState<BuiltinProviderId[] | null>(null);

    async function exportFromDeviceA(): Promise<void> {
        setExportError("");
        const env = await buildEncryptedKeyVault(deviceA, USER, passphrase, {
            providerIds: IDS,
            format: VAULT_FORMAT,
        });
        if (env === null) {
            setExportError("Device A has no keys to export.");
            return;
        }
        setEnvelope(env);
    }

    return (
        <div data-testid="key-vault-roundtrip-example">
            <section data-testid="device-a">
                <h2>Device A - has keys</h2>
                <label htmlFor="rt-pass">Export passphrase</label>
                <input
                    id="rt-pass"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    data-testid="rt-pass"
                />
                <button
                    type="button"
                    onClick={() => void exportFromDeviceA()}
                    disabled={passphrase.length < MIN_PASSPHRASE}
                    data-testid="rt-export"
                >
                    Export encrypted envelope
                </button>
                {exportError && <p data-testid="rt-export-error">{exportError}</p>}
                <textarea
                    readOnly
                    value={envelope}
                    rows={4}
                    data-testid="rt-envelope"
                    aria-label="Exported encrypted envelope"
                />
            </section>

            <section data-testid="device-b">
                <h2>Device B - fresh install</h2>
                <AiSettingsProvider
                    adapter={deviceB}
                    registry={BUILTIN_REGISTRY}
                    userId={USER}
                    vaultFormat={VAULT_FORMAT}
                    browserRuntime
                >
                    <KeyVaultImportForm
                        onImported={(result: KeyVaultImportResult) =>
                            setImported(result.providers as BuiltinProviderId[])
                        }
                    />
                </AiSettingsProvider>
                {imported && (
                    <p data-testid="rt-imported">
                        Imported {imported.length} key(s): {imported.join(", ")}
                    </p>
                )}
            </section>
        </div>
    );
}
