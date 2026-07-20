import { describe, expect, it } from "vitest";

import { maskSecret } from "./mask-secret";

describe("maskSecret", () => {
    it("shows first 4 + ellipsis + last 4 for long secrets", () => {
        expect(maskSecret("AIzaSyA-1234567f3k")).toBe("AIza…7f3k");
    });

    it("collapses short secrets to bullets of the same length", () => {
        expect(maskSecret("short")).toBe("•••••");
        expect(maskSecret("12345678")).toBe("••••••••");
    });

    it("returns null for null / undefined / empty / whitespace", () => {
        expect(maskSecret(null)).toBeNull();
        expect(maskSecret(undefined)).toBeNull();
        expect(maskSecret("")).toBeNull();
        expect(maskSecret("   ")).toBeNull();
    });
});
