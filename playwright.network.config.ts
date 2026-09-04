import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/network.spec.ts",
  workers: 1,
  projects: [
    { name: "WebRTC Chromium", use: { browserName: "chromium" } },
    // WebKit's local mDNS/direct route is not available on every runner.
    // Its separate-context transport is verified through forced TURN.
    ...(process.env.DOKUEL_FORCE_RELAY === "1"
      ? [{ name: "WebRTC WebKit", use: { browserName: "webkit" as const } }]
      : []),
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
