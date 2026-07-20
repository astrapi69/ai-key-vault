/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AiSettingsPanel } from "./AiSettingsPanel";
import { _resetApiKeyStatusCacheForTests } from "../hooks/useApiKeyStatus";
import { makeMockAdapter, makeWrapper } from "../test-utils";

afterEach(() => {
    _resetApiKeyStatusCacheForTests();
});

describe("AiSettingsPanel", () => {
    it("renders a row per registry provider once loaded", async () => {
        const { adapter } = makeMockAdapter({
            initialKeys: { anthropic: "good-ant" },
            initialActive: "anthropic",
        });
        const Wrapper = makeWrapper({ adapter });
        render(
            <Wrapper>
                <AiSettingsPanel />
            </Wrapper>,
        );
        await waitFor(() => expect(screen.getByTestId("settings-panel-ai")).toBeTruthy());
        expect(screen.getByTestId("provider-overview-row-anthropic")).toBeTruthy();
        expect(screen.getByTestId("provider-overview-row-openai")).toBeTruthy();
        expect(screen.getByTestId("provider-overview-row-gemini")).toBeTruthy();
        expect(screen.getByTestId("api-key-row-anthropic")).toBeTruthy();
        // Anthropic has a key -> stored status.
        expect(screen.getByTestId("api-key-status-anthropic").textContent).toBe("Key stored");
    });

    it("changes the active provider from the select", async () => {
        const { adapter, state } = makeMockAdapter({ initialActive: "anthropic" });
        const Wrapper = makeWrapper({ adapter });
        render(
            <Wrapper>
                <AiSettingsPanel />
            </Wrapper>,
        );
        await waitFor(() => expect(screen.getByTestId("settings-provider")).toBeTruthy());
        fireEvent.change(screen.getByTestId("settings-provider"), { target: { value: "gemini" } });
        await waitFor(() => expect(state.activeProvider).toBe("gemini"));
    });

    it("shows the invalid-format hint for a malformed key draft", async () => {
        const { adapter } = makeMockAdapter({ initialActive: "anthropic" });
        const Wrapper = makeWrapper({ adapter });
        render(
            <Wrapper>
                <AiSettingsPanel />
            </Wrapper>,
        );
        await waitFor(() => expect(screen.getByTestId("api-key-input-anthropic")).toBeTruthy());
        // Anthropic requires an sk-ant- prefix; a bare string is invalid.
        fireEvent.change(screen.getByTestId("api-key-input-anthropic"), {
            target: { value: "totally-wrong" },
        });
        expect(screen.getByTestId("api-key-format-error-anthropic")).toBeTruthy();
        expect(screen.getByTestId<HTMLButtonElement>("api-key-save-anthropic").disabled).toBe(true);
    });
});
