import { describe, expect, it } from "vitest";

import { providerKeyStatus } from "./status";

describe("providerKeyStatus", () => {
    it("classifies the four states", () => {
        expect(
            providerKeyStatus({ hasKey: true, source: "settings", browser: false, corsBlocked: false }),
        ).toBe("active");
        expect(
            providerKeyStatus({ hasKey: false, source: "none", browser: false, corsBlocked: false }),
        ).toBe("empty");
        expect(
            providerKeyStatus({ hasKey: true, source: "env", browser: false, corsBlocked: false }),
        ).toBe("external");
        expect(
            providerKeyStatus({ hasKey: true, source: "secrets_file", browser: false, corsBlocked: false }),
        ).toBe("external");
        expect(
            providerKeyStatus({ hasKey: true, source: "settings", browser: true, corsBlocked: true }),
        ).toBe("desktop_only");
    });

    it("desktop_only takes precedence over every key state in a browser runtime", () => {
        expect(
            providerKeyStatus({ hasKey: false, source: "none", browser: true, corsBlocked: true }),
        ).toBe("desktop_only");
    });

    it("a cors-blocked provider on the server runtime is still usable", () => {
        expect(
            providerKeyStatus({ hasKey: true, source: "settings", browser: false, corsBlocked: true }),
        ).toBe("active");
    });
});
