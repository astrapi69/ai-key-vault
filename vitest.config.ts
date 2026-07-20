import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@astrapi69/passphrase-vault": fileURLToPath(
                new URL("./packages/passphrase-vault/src/index.ts", import.meta.url),
            ),
            "@astrapi69/ai-key-vault": fileURLToPath(
                new URL("./packages/core/src/index.ts", import.meta.url),
            ),
            "@astrapi69/ai-key-vault-react": fileURLToPath(
                new URL("./packages/react/src/index.ts", import.meta.url),
            ),
        },
    },
    test: {
        include: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx"],
        environment: "node",
        setupFiles: ["./test-setup.ts"],
    },
});
