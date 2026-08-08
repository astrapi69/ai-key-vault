/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { KeyVaultRoundTripExample } from "./KeyVaultRoundTripExample";
import { makeMockAdapter } from "../test-utils";

const PASS = "roundtrip-pass";

describe("KeyVaultRoundTripExample", () => {
    it("exports keys from device A and imports them into device B end to end", async () => {
        // Device A already holds two keys; device B starts empty.
        const deviceA = makeMockAdapter({
            initialKeys: { anthropic: "good-ant", openai: "good-oai" },
            initialActive: "openai",
        });
        const deviceB = makeMockAdapter({});

        render(
            <KeyVaultRoundTripExample
                deviceA={deviceA.adapter}
                deviceB={deviceB.adapter}
            />,
        );

        // 1) Export an encrypted envelope from device A.
        fireEvent.change(screen.getByTestId("rt-pass"), { target: { value: PASS } });
        fireEvent.click(screen.getByTestId("rt-export"));
        await waitFor(() =>
            expect(
                screen.getByTestId<HTMLTextAreaElement>("rt-envelope").value.length,
            ).toBeGreaterThan(0),
        );
        const envelope = screen.getByTestId<HTMLTextAreaElement>("rt-envelope").value;

        // Nothing has crossed to device B yet.
        expect(deviceB.state.keys).toEqual({});

        // 2) Import that envelope into device B via the real import form.
        fireEvent.change(screen.getByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: PASS },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        // 3) The imported-provider readout comes from onImported(result).
        await waitFor(() =>
            expect(screen.queryByTestId("rt-imported")).not.toBeNull(),
        );
        const readout = screen.getByTestId("rt-imported").textContent ?? "";
        expect(readout).toContain("anthropic");
        expect(readout).toContain("openai");

        // 4) The keys + active provider actually landed on device B.
        expect(deviceB.state.keys).toEqual({
            anthropic: "good-ant",
            openai: "good-oai",
        });
        expect(deviceB.state.activeProvider).toBe("openai");
    });

    it("rejects a wrong passphrase without writing to device B", async () => {
        const deviceA = makeMockAdapter({
            initialKeys: { gemini: "good-gem" },
            initialActive: "gemini",
        });
        const deviceB = makeMockAdapter({});
        render(
            <KeyVaultRoundTripExample
                deviceA={deviceA.adapter}
                deviceB={deviceB.adapter}
            />,
        );

        fireEvent.change(screen.getByTestId("rt-pass"), { target: { value: PASS } });
        fireEvent.click(screen.getByTestId("rt-export"));
        await waitFor(() =>
            expect(
                screen.getByTestId<HTMLTextAreaElement>("rt-envelope").value.length,
            ).toBeGreaterThan(0),
        );
        const envelope = screen.getByTestId<HTMLTextAreaElement>("rt-envelope").value;

        fireEvent.change(screen.getByTestId("key-vault-import-text"), {
            target: { value: envelope },
        });
        fireEvent.change(screen.getByTestId("key-vault-import-pass"), {
            target: { value: "the-wrong-passphrase" },
        });
        fireEvent.click(screen.getByTestId("key-vault-import-button"));

        // No import readout, nothing written to device B.
        await waitFor(() => {
            expect(deviceB.state.keys).toEqual({});
        });
        expect(screen.queryByTestId("rt-imported")).toBeNull();
    });
});
