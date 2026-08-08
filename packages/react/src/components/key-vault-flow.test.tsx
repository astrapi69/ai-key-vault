/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildEncryptedKeyVault } from "@astrapi69/ai-key-vault";

import { KeyVaultImportForm } from "./KeyVaultImportForm";
import { KeyVaultSection } from "./KeyVaultSection";
import {
    collectNotify,
    makeMockAdapter,
    makeWrapper,
    TEST_IDS,
} from "../test-utils";

describe("KeyVaultImportForm", () => {
    it("imports pasted envelope contents into the adapter and notifies", async () => {
        // Produce a real envelope from a source adapter that holds keys.
        const source = makeMockAdapter({
            initialKeys: { anthropic: "good-ant", openai: "good-oai" },
            initialActive: "openai",
        });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "passphrase12", {
            providerIds: TEST_IDS,
        });
        expect(envelope).not.toBeNull();

        const target = makeMockAdapter({});
        const notify = collectNotify();
        const onImported = vi.fn();
        const Wrapper = makeWrapper({ adapter: target.adapter, notify });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={onImported} />
            </Wrapper>,
        );

        fireEvent.change(screen.getByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "passphrase12" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        await waitFor(() => expect(onImported).toHaveBeenCalled());
        expect(target.state.keys).toEqual({ anthropic: "good-ant", openai: "good-oai" });
        expect(target.state.activeProvider).toBe("openai");
        expect(notify.messages.some((m) => m.startsWith("success:"))).toBe(true);
        // onImported reports which providers received a key.
        const result = onImported.mock.calls[0][0];
        expect(result.providers).toEqual(expect.arrayContaining(["anthropic", "openai"]));
        expect(result.providers).toHaveLength(2);
    });

    it("imports a sibling app's envelope with a different format (format-agnostic)", async () => {
        const source = makeMockAdapter({
            initialKeys: { anthropic: "good-ant" },
            initialActive: "anthropic",
        });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "passphrase12", {
            providerIds: TEST_IDS,
            format: "sibling-app-keys",
        });
        const target = makeMockAdapter({});
        // This host stamps a DIFFERENT format on its own exports.
        const Wrapper = makeWrapper({ adapter: target.adapter, vaultFormat: "this-app-keys" });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={vi.fn()} />
            </Wrapper>,
        );

        fireEvent.change(screen.getByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        // The paste is NOT flagged invalid despite the foreign format.
        expect(screen.getByTestId("key-vault-import-text-error").textContent).toBe("");
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "passphrase12" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        await waitFor(() => expect(target.state.keys).toEqual({ anthropic: "good-ant" }));
    });

    it("warns (not errors) on a wrong passphrase and writes nothing", async () => {
        const source = makeMockAdapter({ initialKeys: { gemini: "good-gem" }, initialActive: "gemini" });
        const envelope = await buildEncryptedKeyVault(source.adapter, "u1", "correctpass", {
            providerIds: TEST_IDS,
        });
        const target = makeMockAdapter({});
        const notify = collectNotify();
        const Wrapper = makeWrapper({ adapter: target.adapter, notify });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={vi.fn()} />
            </Wrapper>,
        );

        fireEvent.change(screen.getByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "WRONGpass" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        await waitFor(() =>
            expect(notify.messages.some((m) => m.startsWith("warning:"))).toBe(true),
        );
        expect(target.state.keys).toEqual({});
        expect(notify.messages.some((m) => m.startsWith("error:"))).toBe(false);
    });

    it("flags pasted text that is not a valid envelope and keeps import disabled", () => {
        const target = makeMockAdapter({});
        const Wrapper = makeWrapper({ adapter: target.adapter });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={vi.fn()} />
            </Wrapper>,
        );
        fireEvent.change(screen.getByTestId("key-vault-import-text"), {
            target: { value: "not an envelope" },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "whatever12" },
        });
        expect(screen.getByTestId("key-vault-import-text-error").textContent).not.toBe("");
        expect(screen.getByTestId<HTMLButtonElement>("key-vault-import-button").disabled).toBe(true);
    });
});

describe("KeyVaultSection", () => {
    it("shows the server-mode notice (no export form) when keys are not client-readable", async () => {
        const { adapter } = makeMockAdapter({ clientReadableKeys: false });
        const Wrapper = makeWrapper({ adapter, browserRuntime: false });
        render(
            <Wrapper>
                <KeyVaultSection />
            </Wrapper>,
        );
        expect(screen.getByTestId("key-vault-api-notice")).toBeTruthy();
        expect(screen.queryByTestId("key-vault-export")).toBeNull();
        // Import is still available.
        expect(screen.getByTestId("key-vault-import")).toBeTruthy();
    });

    it("enables export only with keys present and a valid matching passphrase", async () => {
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn(() => "blob:mock"),
            revokeObjectURL: vi.fn(),
        });
        const { adapter } = makeMockAdapter({
            initialKeys: { anthropic: "good-ant" },
            initialActive: "anthropic",
        });
        const Wrapper = makeWrapper({ adapter });
        render(
            <Wrapper>
                <KeyVaultSection />
            </Wrapper>,
        );
        const button = () => screen.getByTestId<HTMLButtonElement>("key-vault-export-button");
        await waitFor(() => expect(button().disabled).toBe(true)); // no passphrase yet

        fireEvent.change(screen.getByTestId("key-vault-export-pass"), {
            target: { value: "passphrase12" },
        });
        fireEvent.change(screen.getByTestId("key-vault-export-confirm"), {
            target: { value: "passphrase12" },
        });
        await waitFor(() => expect(button().disabled).toBe(false));
    });
});
