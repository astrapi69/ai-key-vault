/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { emitSettingsRefresh } from "@astrapi69/ai-key-vault";

import { useAiKeyStore } from "./useAiKeyStore";
import { _resetApiKeyStatusCacheForTests } from "./useApiKeyStatus";
import { collectNotify, makeMockAdapter, makeWrapper } from "../test-utils";

afterEach(() => {
    _resetApiKeyStatusCacheForTests();
});

describe("useAiKeyStore", () => {
    it("loads the snapshot on mount", async () => {
        const { adapter } = makeMockAdapter({
            initialKeys: { anthropic: "good-ant" },
            initialActive: "anthropic",
        });
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.snapshot?.activeProvider).toBe("anthropic");
        expect(result.current.snapshot?.hasKey.anthropic).toBe(true);
        expect(result.current.canTest).toBe(true);
        expect(result.current.canBackup).toBe(true);
    });

    it("saves a key, tests it, backs it up, and activates the first provider", async () => {
        const { adapter, state } = makeMockAdapter();
        const notify = collectNotify();
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter, notify }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setKeyDrafts((p) => ({ ...p, openai: "good-oai" })));
        await act(async () => {
            await result.current.handleSaveKey("openai");
        });

        expect(state.keys.openai).toBe("good-oai");
        expect(state.activeProvider).toBe("openai"); // first key becomes active
        expect(state.backups.openai).toBe("good-oai"); // tested ok -> backed up
        expect(result.current.testResults.openai?.success).toBe(true);
        expect(notify.messages).toContain("success:API key saved.");
    });

    it("a failing live test still saves the key and offers the restore link when a backup exists", async () => {
        const { adapter, state } = makeMockAdapter({
            initialKeys: { anthropic: "good-old" },
            initialActive: "anthropic",
        });
        // Pre-seed a last-known-good backup for anthropic.
        await adapter.backupApiKey!("u1", "anthropic", "good-old");
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setKeyDrafts((p) => ({ ...p, anthropic: "bad-new" })));
        await act(async () => {
            await result.current.handleSaveKey("anthropic");
        });

        expect(state.keys.anthropic).toBe("bad-new"); // saved despite failing test
        expect(result.current.testResults.anthropic?.success).toBe(false);
        expect(result.current.backupAvailable.anthropic).toBe(true);
    });

    it("changes the active provider", async () => {
        const { adapter, state } = makeMockAdapter({ initialActive: "anthropic" });
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => {
            await result.current.handleProviderChange("gemini");
        });
        expect(state.activeProvider).toBe("gemini");
    });

    it("saves and clears a model override", async () => {
        const { adapter, state } = makeMockAdapter({ initialActive: "openai" });
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setModelDrafts((p) => ({ ...p, openai: "gpt-4o" })));
        await act(async () => {
            await result.current.handleSaveModel("openai");
        });
        expect(state.modelOverride.openai).toBe("gpt-4o");

        await act(async () => {
            await result.current.handleClearModel("openai");
        });
        expect(state.modelOverride.openai).toBeNull();
    });

    it("deletes a key only after confirmation", async () => {
        const { adapter, state } = makeMockAdapter({
            initialKeys: { gemini: "good-gem" },
            initialActive: "gemini",
        });
        // Decline first.
        const declined = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter, confirm: () => false }),
        });
        await waitFor(() => expect(declined.result.current.loading).toBe(false));
        await act(async () => {
            await declined.result.current.handleDeleteKey("gemini");
        });
        expect(state.keys.gemini).toBe("good-gem");

        // Confirm second.
        const confirmed = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter, confirm: () => true }),
        });
        await waitFor(() => expect(confirmed.result.current.loading).toBe(false));
        await act(async () => {
            await confirmed.result.current.handleDeleteKey("gemini");
        });
        expect(state.keys.gemini).toBeUndefined();
    });

    it("re-reads the snapshot on a settings-refresh bus emit (out-of-band import, #1836)", async () => {
        const { adapter, state } = makeMockAdapter({ initialActive: "anthropic" });
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.snapshot?.hasKey.anthropic).toBe(false);

        // Simulate an out-of-band write (e.g. the key-vault import form) that
        // announces itself on the shared bus.
        state.keys.anthropic = "good-imported";
        await act(async () => {
            emitSettingsRefresh();
            await Promise.resolve();
        });
        await waitFor(() => expect(result.current.snapshot?.hasKey.anthropic).toBe(true));
    });

    it("hides test/backup affordances when the adapter lacks the capabilities", async () => {
        const { adapter } = makeMockAdapter({ liveTest: false, keyBackup: false });
        const { result } = renderHook(() => useAiKeyStore(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.canTest).toBe(false);
        expect(result.current.canBackup).toBe(false);
    });
});
