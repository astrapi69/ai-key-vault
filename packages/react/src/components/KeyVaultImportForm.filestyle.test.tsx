/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { KeyVaultImportForm } from "./KeyVaultImportForm";
import { collectNotify, makeMockAdapter, makeWrapper } from "../test-utils";

describe("KeyVaultImportForm file input (#15)", () => {
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

    it("carries a stable, dedicated class a host can target from its OWN CSS - the kit ships no appearance itself (app-agnostic, same as the Button/Input/Link slots)", () => {
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
