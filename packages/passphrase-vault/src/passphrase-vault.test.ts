import { describe, expect, it } from "vitest";

import {
    DEFAULT_VAULT_FORMAT,
    VaultDecryptError,
    decryptAndUpgradeVault,
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
        // OWASP Password Storage Cheat Sheet figure for PBKDF2-HMAC-SHA256.
        expect(envelope.kdf.iterations).toBe(600_000);
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

/**
 * The unlock path of a vault kept at rest, the way a consumer wires it: read
 * the stored copy, unlock, and write the upgraded envelope back when there
 * is one.
 */
async function unlockStored<T>(
    store: { envelope: string },
    passphrase: string,
    format: string,
): Promise<T> {
    const { value, upgradedEnvelope } = await decryptAndUpgradeVault<T>(
        store.envelope,
        passphrase,
        { format },
    );
    if (upgradedEnvelope !== null) store.envelope = upgradedEnvelope;
    return value;
}

describe("decryptAndUpgradeVault", () => {
    it("upgrades a 250,000 vault to 600,000 on unlock, and it opens again", async () => {
        const store = { envelope: LEGACY_250K_VAULT };

        const first = await unlockStored<typeof PAYLOAD>(store, LEGACY_PASSPHRASE, LEGACY_FORMAT);
        expect(first).toEqual(PAYLOAD);

        const upgraded = JSON.parse(store.envelope);
        expect(upgraded.kdf.iterations).toBe(600_000);
        expect(upgraded.format).toBe(LEGACY_FORMAT);
        expect(upgraded.version).toBe(1);
        const legacy = JSON.parse(LEGACY_250K_VAULT);
        expect(upgraded.kdf.salt).not.toBe(legacy.kdf.salt);
        expect(upgraded.cipher.iv).not.toBe(legacy.cipher.iv);

        // The upgraded copy opens with the same passphrase, through both paths.
        expect(
            await decryptFromVault(store.envelope, LEGACY_PASSPHRASE, { format: LEGACY_FORMAT }),
        ).toEqual(PAYLOAD);
        const afterUpgrade = store.envelope;
        const second = await unlockStored<typeof PAYLOAD>(store, LEGACY_PASSPHRASE, LEGACY_FORMAT);
        expect(second).toEqual(PAYLOAD);
        // Already current: the second unlock leaves the stored copy as it is.
        expect(store.envelope).toBe(afterUpgrade);
    });

    it("leaves the stored vault untouched on a wrong passphrase", async () => {
        const store = { envelope: LEGACY_250K_VAULT };
        await expect(
            unlockStored(store, "wrong", LEGACY_FORMAT),
        ).rejects.toBeInstanceOf(VaultDecryptError);
        expect(store.envelope).toBe(LEGACY_250K_VAULT);
    });

    it("hands back no upgrade for a vault already at 600,000", async () => {
        const envelope = await encryptToVault(PAYLOAD, "pw");
        const result = await decryptAndUpgradeVault<typeof PAYLOAD>(envelope, "pw");
        expect(result.value).toEqual(PAYLOAD);
        expect(result.upgradedEnvelope).toBeNull();
    });

    it("rejects a format mismatch like decryptFromVault", async () => {
        await expect(
            decryptAndUpgradeVault(LEGACY_250K_VAULT, LEGACY_PASSPHRASE),
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
