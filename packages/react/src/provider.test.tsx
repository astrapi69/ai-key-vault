/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";

import { useAiSettingsContext } from "./context";
import { DefaultButton, DefaultInput, DefaultLink } from "./slots";
import { makeMockAdapter, makeWrapper } from "./test-utils";

describe("useAiSettingsContext", () => {
    it("throws when used outside a provider", () => {
        expect(() => renderHook(() => useAiSettingsContext())).toThrow(
            /must be used within an <AiSettingsProvider>/,
        );
    });

    it("supplies the injected values and default slots", () => {
        const { adapter } = makeMockAdapter();
        const wrapper = makeWrapper({ adapter, userId: "u9" });
        const { result } = renderHook(() => useAiSettingsContext(), { wrapper });
        expect(result.current.userId).toBe("u9");
        expect(result.current.registry.ids).toEqual(["anthropic", "openai", "gemini"]);
        expect(result.current.Button).toBe(DefaultButton);
        expect(result.current.Input).toBe(DefaultInput);
        expect(result.current.Link).toBe(DefaultLink);
        // browserRuntime defaults to the adapter's clientReadableKeys.
        expect(result.current.browserRuntime).toBe(true);
    });
});

describe("default slots", () => {
    it("DefaultLink renders an anchor to `to`", () => {
        render(<DefaultLink to="/settings?tab=ai" data-testid="lnk">Open</DefaultLink>);
        const link = screen.getByTestId("lnk");
        expect(link.tagName).toBe("A");
        expect(link.getAttribute("href")).toBe("/settings?tab=ai");
    });

    it("DefaultButton carries variant/size as data attributes", () => {
        render(
            <DefaultButton variant="destructive" size="sm" data-testid="btn">
                X
            </DefaultButton>,
        );
        const btn = screen.getByTestId("btn");
        expect(btn.getAttribute("data-variant")).toBe("destructive");
        expect(btn.getAttribute("data-size")).toBe("sm");
    });
});
