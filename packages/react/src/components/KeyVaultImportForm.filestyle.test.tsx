/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { KeyVaultImportForm } from "./KeyVaultImportForm";
import { collectNotify, makeMockAdapter, makeWrapper } from "../test-utils";

describe("KeyVaultImportForm file input styling", () => {
    it("styles the native file-picker button to match the rest of the panel", () => {
        const target = makeMockAdapter({});
        const notify = collectNotify();
        const Wrapper = makeWrapper({ adapter: target.adapter, notify });
        render(
            <Wrapper>
                <KeyVaultImportForm onImported={() => {}} />
            </Wrapper>,
        );

        const input = screen.getByTestId("key-vault-import-file");
        // Tailwind's file: variant targets the UA button pseudo-element;
        // an unstyled input carries none of these classes.
        expect(input.className).toContain("file:bg-primary");
        expect(input.className).toContain("file:text-primary-foreground");
    });
});
