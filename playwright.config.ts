import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/results",
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:5173",
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
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
