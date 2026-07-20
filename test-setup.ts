import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount any React trees rendered by @testing-library between tests so
// getByTestId does not see leftovers from a previous test. Harmless for the
// non-React (node-env) packages, which never render.
afterEach(() => {
    cleanup();
});
