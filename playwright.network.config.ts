import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/network.spec.ts",
  workers: 1,
  use: { ...base.use, baseURL: "http://127.0.0.1:4173" },
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
      // Bind the address that the readiness probe and browsers actually use.
      // localhost can resolve to ::1 while the probe connects over IPv4.
      command: "bunx vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run --cwd signaling dev --local --ip 127.0.0.1 --port 8787",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
