import { describe, expect, it } from "vitest";

import { partitionModels } from "./partition-models";

const FAMILIES = ["gpt-4o-mini", "gpt-4o", "o3-mini"] as const;

describe("partitionModels", () => {
    it("claims each model by its most specific family and keeps curated order", () => {
        const models = [
            { id: "gpt-4o-2024-08-06" },
            { id: "gpt-4o-mini-2024-07-18" },
            { id: "o3-mini" },
            { id: "gpt-3.5-turbo" },
        ];
        const { recommended, rest } = partitionModels(FAMILIES, models);
        expect(recommended.map((m) => m.id)).toEqual([
            "gpt-4o-mini-2024-07-18",
            "gpt-4o-2024-08-06",
            "o3-mini",
        ]);
        expect(rest.map((m) => m.id)).toEqual(["gpt-3.5-turbo"]);
    });

    it("prefers the newest (lexically largest) variant within a family", () => {
        const models = [
            { id: "gpt-4o-mini-2024-07-18" },
            { id: "gpt-4o-mini-2025-01-01" },
        ];
        const { recommended } = partitionModels(FAMILIES, models);
        expect(recommended.map((m) => m.id)).toEqual(["gpt-4o-mini-2025-01-01"]);
    });

    it("falls back to first-3 when no model matches any family", () => {
        const models = [{ id: "x1" }, { id: "x2" }, { id: "x3" }, { id: "x4" }];
        const { recommended, rest } = partitionModels(FAMILIES, models);
        expect(recommended.map((m) => m.id)).toEqual(["x1", "x2", "x3"]);
        expect(rest.map((m) => m.id)).toEqual(["x4"]);
    });

    it("handles empty inputs", () => {
        expect(partitionModels(FAMILIES, [])).toEqual({ recommended: [], rest: [] });
        expect(partitionModels([], [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }])).toEqual({
            recommended: [{ id: "a" }, { id: "b" }, { id: "c" }],
            rest: [{ id: "d" }],
        });
    });
});
