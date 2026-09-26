import { describe, expect, it } from "vitest";
import { precacheUrls } from "./sw-precache.ts";

describe("precacheUrls", () => {
  it("keeps the app shell and serves index.html as the root URL", () => {
    expect(
      precacheUrls([
        "index.html",
        "assets/index-CrMoA-XG.js",
        "assets/index-DtG_WX8Y.css",
        "assets/dm-sans-latin-opsz-normal-Bf69Tn_J.woff2",
        "favicon.svg",
        "icons/icon-192.png",
        "manifest.webmanifest",
      ]),
    ).toEqual([
      "/",
      "/assets/dm-sans-latin-opsz-normal-Bf69Tn_J.woff2",
      "/assets/index-CrMoA-XG.js",
      "/assets/index-DtG_WX8Y.css",
      "/favicon.svg",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
    ]);
  });

  it("leaves out host config, crawler files, the worker itself and source maps", () => {
    // _headers/_redirects are Cloudflare config, never fetched by the
    // app; robots/sitemap/og-image serve crawlers; sw.js must always
    // come from the network or updates could never land.
    expect(
      precacheUrls([
        "_headers",
        "_redirects",
        "robots.txt",
        "sitemap.xml",
        "og-image.png",
        "vite.svg",
        "sw.js",
        "assets/index-CrMoA-XG.js.map",
        "assets/index-CrMoA-XG.js",
      ]),
    ).toEqual(["/assets/index-CrMoA-XG.js"]);
  });
});
