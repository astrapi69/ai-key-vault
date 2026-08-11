/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { KeyVaultImportForm } from "./KeyVaultImportForm";
import { collectNotify, makeMockAdapter, makeWrapper } from "../test-utils";

describe("KeyVaultImportForm file input styling (#15)", () => {
    it("does NOT rely on Tailwind file: utility classes - the host's JIT scanner never sees node_modules, so file:* classes silently render as no-op strings (verified: 0.3.1 shipped file:bg-primary and it never produced a single CSS rule in a real consumer build)", () => {
        const target = makeMockAdapter({});
        const notify = collectNotify();
        const Wrapper = makeWrapper({ adapter: target.adapter, notify });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={() => {}} />
            </Wrapper>,
        );

        const input = screen.getByTestId("key-vault-import-file");
        expect(input.className).not.toMatch(/\bfile:/);
    });

    it("ships its own ::file-selector-button rule via a CSS custom property with a fallback default", () => {
        const target = makeMockAdapter({});
        const notify = collectNotify();
        const Wrapper = makeWrapper({ adapter: target.adapter, notify });
        const { container } = render(
            <Wrapper>
                <KeyVaultImportForm onImported={() => {}} />
            </Wrapper>,
        );

        const styleTags = Array.from(container.querySelectorAll("style"));
        const css = styleTags.map((s) => s.textContent ?? "").join("\n");
        // Both the standard and the legacy WebKit selector, so the rule
        // actually reaches the button in every evergreen browser.
        expect(css).toMatch(/::file-selector-button/);
        expect(css).toMatch(/::-webkit-file-upload-button/);
        // A CSS variable with a fallback: a host that never sets
        // --akv-primary still gets a real, non-native appearance.
        expect(css).toMatch(/var\(--akv-primary,\s*#[0-9a-fA-F]{3,6}\)/);
    });

    it("marks the input with the selector class the shipped rule targets", () => {
        const target = makeMockAdapter({});
        const notify = collectNotify();
        const Wrapper = makeWrapper({ adapter: target.adapter, notify });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={() => {}} />
            </Wrapper>,
        );

        const input = screen.getByTestId("key-vault-import-file");
        expect(input.className).toContain("akv-file-input");
    });
});
