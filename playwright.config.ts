import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Parallel worktrees (agents, side-by-side branches) each need their own
// preview server, so the port is overridable instead of pinned.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/results",
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  globalSetup: "./e2e/check-build-fresh.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  // CI runners are slower and shared — retry there to absorb transient
  // slowness, but keep local runs strict so real flakiness surfaces.
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : 4,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: isCI ? "on-first-retry" : "off",
  },
  webServer: {
    command: `bunx vite preview --port ${port} --strictPort`,
    port,
    // Locally a running preview server is a convenience; on CI reusing
    // a stray server would test stale output.
    reuseExistingServer: !isCI,
  },
  projects: [
    {
      name: "iPhone SE",
      use: {
        ...devices["iPhone SE"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
      },
    },
    {
      name: "iPhone 14",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
      },
    },
    {
      name: "iPad Mini",
      use: {
        ...devices["iPad Mini"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
      },
    },
    {
      name: "Desktop",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
