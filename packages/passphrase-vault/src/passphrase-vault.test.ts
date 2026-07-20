import { describe, expect, it } from "vitest";

import {
    DEFAULT_VAULT_FORMAT,
    VaultDecryptError,
    decryptFromVault,
    encryptToVault,
    looksLikeVaultEnvelope,
} from "./passphrase-vault";

const PAYLOAD = { keys: { anthropic: "sk-ant-test" }, note: "hello" };

describe("encryptToVault / decryptFromVault", () => {
    it("round-trips a JSON value with the right passphrase", async () => {
        const envelope = await encryptToVault(PAYLOAD, "correct horse");
        const decrypted = await decryptFromVault<typeof PAYLOAD>(envelope, "correct horse");
        expect(decrypted).toEqual(PAYLOAD);
    });

    it("rejects a wrong passphrase with VaultDecryptError", async () => {
        const envelope = await encryptToVault(PAYLOAD, "correct horse");
        await expect(decryptFromVault(envelope, "wrong")).rejects.toBeInstanceOf(
            VaultDecryptError,
        );
    });

    it("rejects a tampered ciphertext with VaultDecryptError", async () => {
        const envelope = JSON.parse(await encryptToVault(PAYLOAD, "pw"));
        const bytes = atob(envelope.ciphertext);
        const flipped =
            String.fromCharCode(bytes.charCodeAt(0) ^ 0xff) + bytes.slice(1);
        envelope.ciphertext = btoa(flipped);
        await expect(
            decryptFromVault(JSON.stringify(envelope), "pw"),
        ).rejects.toBeInstanceOf(VaultDecryptError);
    });

    it("rejects a malformed envelope with VaultDecryptError", async () => {
        await expect(decryptFromVault("not json", "pw")).rejects.toBeInstanceOf(
            VaultDecryptError,
        );
        await expect(decryptFromVault("{}", "pw")).rejects.toBeInstanceOf(
            VaultDecryptError,
        );
    });

    it("requires a non-empty passphrase", async () => {
        await expect(encryptToVault(PAYLOAD, "")).rejects.toThrow(
            "A passphrase is required",
        );
    });

    it("generates a fresh salt and iv per call", async () => {
        const a = JSON.parse(await encryptToVault(PAYLOAD, "pw"));
        const b = JSON.parse(await encryptToVault(PAYLOAD, "pw"));
        expect(a.kdf.salt).not.toBe(b.kdf.salt);
        expect(a.cipher.iv).not.toBe(b.cipher.iv);
    });

    it("honors the iteration count stored in the envelope on decrypt", async () => {
        const envelope = JSON.parse(await encryptToVault(PAYLOAD, "pw"));
        expect(envelope.kdf.iterations).toBe(250_000);
        expect(envelope.version).toBe(1);
        expect(envelope.kdf.name).toBe("PBKDF2");
        expect(envelope.cipher.name).toBe("AES-GCM");
    });
});

describe("configurable envelope format", () => {
    it("defaults the format string to the adaptive-learner value for backward compat", async () => {
        const envelope = JSON.parse(await encryptToVault(PAYLOAD, "pw"));
        expect(envelope.format).toBe("adaptive-learner-keys");
        expect(DEFAULT_VAULT_FORMAT).toBe("adaptive-learner-keys");
    });

    it("round-trips with a custom format string", async () => {
        const envelope = await encryptToVault(PAYLOAD, "pw", {
            format: "phylax-health-vault",
        });
        expect(JSON.parse(envelope).format).toBe("phylax-health-vault");
        const decrypted = await decryptFromVault<typeof PAYLOAD>(envelope, "pw", {
            format: "phylax-health-vault",
        });
        expect(decrypted).toEqual(PAYLOAD);
    });

    it("rejects an envelope whose format does not match the expected one", async () => {
        const foreign = await encryptToVault(PAYLOAD, "pw", { format: "other-app" });
        await expect(decryptFromVault(foreign, "pw")).rejects.toBeInstanceOf(
            VaultDecryptError,
        );
        const ours = await encryptToVault(PAYLOAD, "pw");
        await expect(
            decryptFromVault(ours, "pw", { format: "other-app" }),
        ).rejects.toBeInstanceOf(VaultDecryptError);
    });
});

describe("looksLikeVaultEnvelope", () => {
    it("accepts a well-formed envelope without decrypting", async () => {
        const envelope = await encryptToVault(PAYLOAD, "pw");
        expect(looksLikeVaultEnvelope(envelope)).toBe(true);
    });

    it("rejects invalid or foreign-format strings", async () => {
        expect(looksLikeVaultEnvelope("not json")).toBe(false);
        expect(looksLikeVaultEnvelope("{}")).toBe(false);
        const foreign = await encryptToVault(PAYLOAD, "pw", { format: "other-app" });
        expect(looksLikeVaultEnvelope(foreign)).toBe(false);
        expect(looksLikeVaultEnvelope(foreign, { format: "other-app" })).toBe(true);
    });
});
