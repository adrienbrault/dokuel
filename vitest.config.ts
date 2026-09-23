import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "signaling/src/**/*.test.ts"],
    // A spy left installed by a failing test must not cascade into the
    // next test's failure — restore all mocks between tests.
    restoreMocks: true,
    // jsdom renders of full game screens take ~1s alone but blow past the
    // 5s default when the CPU is shared (parallel agents, loaded CI
    // runners). A slow machine is not a failing test.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "signaling/src/**"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "signaling/src/**/*.test.ts",
        "src/test-setup.ts",
        // Durable Object wiring; imports cloudflare:workers, which only
        // resolves inside the Workers runtime.
        "signaling/src/index.ts",
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
