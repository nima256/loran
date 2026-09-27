import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

/**
 * Test runner configuration.
 *
 * `server-only` is aliased to a stub: the service modules import it to make a
 * client-component import a build error, which is exactly what we want in the
 * app and exactly what stops a plain Node test from loading them.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The integration tests share one database, so they must not interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
      "@": path.resolve(root, "src"),
    },
  },
});
