import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Interaction-heavy tests (user-event, Radix popovers) passed alone but hit the
    // 5 s default when the full suite ran next to builds on a busy machine.
    testTimeout: 15_000,
    // Unit tests run on the built-in sample data (the mock API), never on a backend.
    env: { NEXT_PUBLIC_USE_MOCK: "true" },
  },
});
