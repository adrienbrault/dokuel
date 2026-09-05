import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/network.spec.ts",
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
    baseURL: "http://localhost:4173",
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: isCI ? "on-first-retry" : "off",
  },
  webServer: {
    command: "bunx vite preview --port 4173 --strictPort",
    port: 4173,
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
