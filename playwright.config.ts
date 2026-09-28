import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Headless Chromium picks a software rasteriser when it is not told
// otherwise, and every page now carries a WebGL board. On the software path
// a tablet-sized board costs half a second of main-thread time per frame -
// enough to starve input handling and blow actionability timeouts on the
// larger viewports, where the board is biggest. Where a real GPU is
// reachable, ask ANGLE for it: the same hardware path the shipped app
// takes, and the only way these shots show what a device actually paints.
// Linux runners have no Metal, so they keep the software path and its
// retries.
const gpuArgs = process.platform === "darwin" ? ["--use-angle=metal"] : [];

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
    baseURL: "http://localhost:4173",
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: isCI ? "on-first-retry" : "off",
    launchOptions: { args: gpuArgs },
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
