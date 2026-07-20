/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { emitSettingsRefresh } from "@astrapi69/ai-key-vault";

import { _resetApiKeyStatusCacheForTests, useApiKeyStatus } from "./useApiKeyStatus";
import { makeMockAdapter, makeWrapper } from "../test-utils";

afterEach(() => {
    _resetApiKeyStatusCacheForTests();
});

describe("useApiKeyStatus", () => {
    it("reports the active provider's key presence once ready", async () => {
        const { adapter } = makeMockAdapter({
            initialKeys: { anthropic: "good-ant" },
            initialActive: "anthropic",
        });
        const { result } = renderHook(() => useApiKeyStatus(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.hasKey).toBe(true);
        expect(result.current.activeProvider).toBe("anthropic");
    });

    it("reports hasKey=false when the active provider has no key", async () => {
        const { adapter } = makeMockAdapter({ initialActive: "openai" });
        const { result } = renderHook(() => useApiKeyStatus(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.hasKey).toBe(false);
    });

    it("re-reads after a settings-refresh bus emit (key added out of band)", async () => {
        const { adapter, state } = makeMockAdapter({ initialActive: "gemini" });
        const { result } = renderHook(() => useApiKeyStatus(), {
            wrapper: makeWrapper({ adapter }),
        });
        await waitFor(() => expect(result.current.ready).toBe(true));
        expect(result.current.hasKey).toBe(false);

        state.keys.gemini = "good-gem";
        _resetApiKeyStatusCacheForTests();
        await act(async () => {
            emitSettingsRefresh();
            await Promise.resolve();
        });
        await waitFor(() => expect(result.current.hasKey).toBe(true));
    });

    it("stays not-ready with a null userId", async () => {
        const { adapter } = makeMockAdapter();
        const { result } = renderHook(() => useApiKeyStatus(), {
            wrapper: makeWrapper({ adapter, userId: null }),
        });
        expect(result.current.ready).toBe(false);
        expect(result.current.activeProvider).toBeNull();
    });
});
