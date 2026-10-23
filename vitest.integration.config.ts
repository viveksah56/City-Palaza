import { defineConfig } from "vitest/config";
import path from "node:path";

// Runs against a REAL PostgreSQL database. Set TEST_DATABASE_URL (never your dev/prod DB:
// the tests truncate tables).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: { AUTH_SECRET: "test-secret-test-secret-test-secret-123456" },
  },
});
