import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/network.spec.ts",
  workers: 1,
  projects: [
    { name: "WebRTC Chromium", use: { browserName: "chromium" } },
    { name: "WebRTC WebKit", use: { browserName: "webkit" } },
  ],
  webServer: [
    {
      command: "bunx vite preview --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "bunx wrangler dev --config signaling/wrangler.toml --local --port 8787",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
