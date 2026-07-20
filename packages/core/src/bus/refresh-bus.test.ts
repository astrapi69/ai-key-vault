import { afterEach, describe, expect, it, vi } from "vitest";

import {
    emitSettingsRefresh,
    resetSettingsRefreshBus,
    subscribeSettingsRefresh,
} from "./refresh-bus";

afterEach(() => {
    resetSettingsRefreshBus();
});

describe("settings refresh bus", () => {
    it("notifies every subscriber on emit", () => {
        const a = vi.fn();
        const b = vi.fn();
        subscribeSettingsRefresh(a);
        subscribeSettingsRefresh(b);
        emitSettingsRefresh();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it("stops notifying after unsubscribe", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSettingsRefresh(listener);
        unsubscribe();
        emitSettingsRefresh();
        expect(listener).not.toHaveBeenCalled();
    });

    it("reset clears all listeners", () => {
        const listener = vi.fn();
        subscribeSettingsRefresh(listener);
        resetSettingsRefreshBus();
        emitSettingsRefresh();
        expect(listener).not.toHaveBeenCalled();
    });
});
