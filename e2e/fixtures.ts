import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { test as base } from "@playwright/test";

const DIST = join(import.meta.dirname, "..", "dist");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/**
 * Custom test fixture that serves the built `dist/` directory via Playwright's
 * request interception. This avoids the need for a running web server, which
 * does not work in containerized environments where Chromium's network sandbox
 * blocks access to localhost.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = join(DIST, pathname);

      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const body = readFileSync(filePath);
        await route.fulfill({
          status: 200,
          contentType: MIME[ext] || "application/octet-stream",
          body,
        });
      } else {
        // SPA fallback — serve index.html for client-side routes
        const body = readFileSync(join(DIST, "index.html"));
        await route.fulfill({ status: 200, contentType: "text/html", body });
      }
    });

    await use(context);
  },
});
