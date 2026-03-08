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
      use: { ...devices["iPhone SE"], deviceScaleFactor: 1 },
    },
    {
      name: "iPhone 14",
      use: { ...devices["iPhone 14"], deviceScaleFactor: 1 },
    },
    {
      name: "iPad Mini",
      use: { ...devices["iPad Mini"], deviceScaleFactor: 1 },
    },
    {
      name: "Desktop",
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
