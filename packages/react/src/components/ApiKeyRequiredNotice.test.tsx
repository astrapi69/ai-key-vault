/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ApiKeyRequiredNotice } from "./ApiKeyRequiredNotice";
import { makeMockAdapter, makeWrapper } from "../test-utils";

describe("ApiKeyRequiredNotice", () => {
    it("renders the notice and a settings link to the default target", () => {
        const { adapter } = makeMockAdapter();
        const Wrapper = makeWrapper({ adapter });
        render(
            <Wrapper>
                <ApiKeyRequiredNotice />
            </Wrapper>,
        );
        expect(screen.getByTestId("api-key-required-notice")).toBeTruthy();
        const link = screen.getByTestId("api-key-required-link");
        expect(link.getAttribute("href")).toBe("/settings?tab=ai");
    });

    it("weaves the feature into the message and honours a custom href", () => {
        const { adapter } = makeMockAdapter();
        const Wrapper = makeWrapper({ adapter });
        render(
            <Wrapper>
                <ApiKeyRequiredNotice compact feature="to analyze conversations" settingsHref="/x" />
            </Wrapper>,
        );
        expect(screen.getByTestId("api-key-required-notice").textContent).toContain(
            "to analyze conversations",
        );
        expect(screen.getByTestId("api-key-required-link").getAttribute("href")).toBe("/x");
    });
});
