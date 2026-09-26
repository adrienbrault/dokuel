/**
 * Which built files the service worker downloads on install, so the
 * app shell (solo, daily, stats, resume) boots with no network.
 *
 * Pure: the build plugin feeds it every emitted file name, relative
 * to the output root.
 */

// Served by the host or to crawlers, never fetched by the running
// app. sw.js itself must always come from the network, or a new
// deploy could never replace it.
const EXCLUDED = new Set([
  "_headers",
  "_redirects",
  "robots.txt",
  "sitemap.xml",
  "og-image.png",
  "vite.svg",
  "sw.js",
]);

export function precacheUrls(files: readonly string[]): string[] {
  return (
    files
      .filter((f) => !EXCLUDED.has(f) && !f.endsWith(".map"))
      // Cloudflare Pages answers /index.html with a redirect to /, and
      // a redirected response cannot answer a navigation. Cache the
      // shell under the URL that returns it directly.
      .map((f) => (f === "index.html" ? "/" : `/${f}`))
      .sort()
  );
}
