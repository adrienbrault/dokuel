import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/results",
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  globalSetup: "./e2e/check-build-fresh.ts",
  fullyParallel: true,
  workers: 4,
  timeout: 8_000,
  expect: { timeout: 3_000 },
  use: {
    baseURL: "http://localhost:4173",
    actionTimeout: 3_000,
    navigationTimeout: 5_000,
  },
  webServer: {
    command: "bunx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
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
