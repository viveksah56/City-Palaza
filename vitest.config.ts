import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**"],
    env: { AUTH_SECRET: "test-secret-test-secret-test-secret-123456" },
  },
});
