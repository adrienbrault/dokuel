import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "signaling/tests/**/*.test.ts"],
    // A spy left installed by a failing test must not cascade into the
    // next test's failure — restore all mocks between tests.
    restoreMocks: true,
    // Instrumented board interactions and puzzle generation can exceed five
    // seconds on shared CI CPUs. Keep local feedback strict and assertions intact.
    testTimeout: process.env.CI ? 15_000 : 5_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test-setup.ts",
        "src/lib/types.ts",
        "src/lib/constants.ts",
      ],
      // Branch threshold reflects useYjsMultiplayer being measured: the
      // suite genuinely covers ~85% of branches with it included, which
      // is more honest than the previous 88% computed while excluding
      // the hardest file. Ratchet upward as its coverage grows.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
