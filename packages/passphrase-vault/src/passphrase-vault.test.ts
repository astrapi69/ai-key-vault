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

    it("stamps the KDF and cipher parameters into a new envelope", async () => {
        const envelope = JSON.parse(await encryptToVault(PAYLOAD, "pw"));
        expect(envelope.kdf.iterations).toBe(250_000);
        expect(envelope.version).toBe(1);
        expect(envelope.kdf.name).toBe("PBKDF2");
        expect(envelope.kdf.hash).toBe("SHA-256");
        expect(envelope.cipher.name).toBe("AES-GCM");
    });
});

/**
 * A vault written by @astrapi69/passphrase-vault 0.1.1 (main 7493757) with
 * 250,000 PBKDF2 iterations: passphrase "correct horse", payload PAYLOAD.
 * Kept byte for byte so the read path stays compatible with files already in
 * the wild, independent of the iteration count new vaults use.
 */
const LEGACY_FORMAT = "legacy-fixture";
const LEGACY_PASSPHRASE = "correct horse";
const LEGACY_250K_VAULT = JSON.stringify({
    format: LEGACY_FORMAT,
    version: 1,
    kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: 250000,
        salt: "O+MemDUjHKbo5ljA16xWVw==",
    },
    cipher: { name: "AES-GCM", iv: "TKxcMWVNeE0d4LYl" },
    ciphertext:
        "Dz03fCDuEh00G7FBBT99mxLVeHe1sfexiY4HI8TN0LjsPK5xHCeIpi07u6S0c4hQl0UfVtyRHZYSnjIfH1nXcsl+zw==",
});

describe("a vault written with 250,000 iterations (0.1.1)", () => {
    it("is the 0.1.1 envelope shape with 250,000 iterations", () => {
        expect(JSON.parse(LEGACY_250K_VAULT).kdf.iterations).toBe(250_000);
        expect(looksLikeVaultEnvelope(LEGACY_250K_VAULT, { format: LEGACY_FORMAT })).toBe(true);
    });

    it("opens with its passphrase, deriving with the count it stores", async () => {
        const decrypted = await decryptFromVault<typeof PAYLOAD>(
            LEGACY_250K_VAULT,
            LEGACY_PASSPHRASE,
            { format: LEGACY_FORMAT },
        );
        expect(decrypted).toEqual(PAYLOAD);
    });

    it("rejects a wrong passphrase with VaultDecryptError", async () => {
        await expect(
            decryptFromVault(LEGACY_250K_VAULT, "wrong", { format: LEGACY_FORMAT }),
        ).rejects.toBeInstanceOf(VaultDecryptError);
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
