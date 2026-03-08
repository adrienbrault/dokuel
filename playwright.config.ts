import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/results",
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "bun run dev",
    port: 5173,
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
    {
      name: "iPhone 14 Safari",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
        // Real Safari portrait with status bar + bottom toolbar (~190px lost)
        viewport: { width: 390, height: 654 },
      },
    },
    {
      name: "iPhone 14 Landscape",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: "iPhone SE Landscape",
      use: {
        ...devices["iPhone SE"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
        viewport: { width: 667, height: 375 },
      },
    },
    {
      name: "iPhone 14 Landscape Safari",
      use: {
        ...devices["iPhone 14"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
        // Real Safari landscape with toolbar visible (~50px lost)
        viewport: { width: 844, height: 340 },
      },
    },
    {
      name: "iPhone SE Landscape Safari",
      use: {
        ...devices["iPhone SE"],
        defaultBrowserType: "chromium",
        deviceScaleFactor: 1,
        viewport: { width: 667, height: 325 },
      },
    },
  ],
});
