import { describe, expect, it } from "vitest";

import { isValidApiKeyFormat } from "./key-format";
import { BUILTIN_PROVIDERS } from "./registry";

const rule = (id: string) => {
    const descriptor = BUILTIN_PROVIDERS.find((d) => d.id === id);
    if (!descriptor) throw new Error(`missing descriptor ${id}`);
    return descriptor.keyFormat;
};

describe("isValidApiKeyFormat", () => {
    it("accepts a well-formed anthropic key and rejects a truncated one", () => {
        expect(isValidApiKeyFormat(rule("anthropic"), "sk-ant-" + "a".repeat(40))).toBe(true);
        expect(isValidApiKeyFormat(rule("anthropic"), "sk-ant-short")).toBe(false);
        expect(isValidApiKeyFormat(rule("anthropic"), "sk-" + "a".repeat(40))).toBe(false);
    });

    it("accepts an openai key with the sk- prefix", () => {
        expect(isValidApiKeyFormat(rule("openai"), "sk-" + "b".repeat(30))).toBe(true);
        expect(isValidApiKeyFormat(rule("openai"), "b".repeat(30))).toBe(false);
    });

    it("gemini: no prefix requirement, but rejects an sk- key pasted into the wrong field", () => {
        expect(isValidApiKeyFormat(rule("gemini"), "AIza" + "c".repeat(20))).toBe(true);
        expect(isValidApiKeyFormat(rule("gemini"), "zz" + "c".repeat(20))).toBe(true);
        expect(isValidApiKeyFormat(rule("gemini"), "sk-" + "c".repeat(30))).toBe(false);
    });

    it("rejects empty keys and keys with inner whitespace, trims outer whitespace", () => {
        expect(isValidApiKeyFormat(rule("openai"), "")).toBe(false);
        expect(isValidApiKeyFormat(rule("openai"), "sk-" + "b".repeat(10) + " " + "b".repeat(10))).toBe(false);
        expect(isValidApiKeyFormat(rule("openai"), "  sk-" + "b".repeat(30) + "\n")).toBe(true);
    });

    it("supports a keyless rule (minLength 0 still rejects empty input)", () => {
        expect(isValidApiKeyFormat({ minLength: 0 }, "anything")).toBe(true);
        expect(isValidApiKeyFormat({ minLength: 0 }, "")).toBe(false);
    });
});
