import { createHash } from "node:crypto";
import type { Plugin } from "vite";

// Cache one complete build. Waiting workers activate after existing tabs close,
// so a deployment cannot replace the assets underneath an in-progress game.
export function offlinePlugin(): Plugin {
  return {
    name: "dokuel-offline",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_, bundle) {
        const files = Object.keys(bundle).filter(
          (file) => !file.endsWith(".map"),
        );
        const digest = createHash("sha256");
        for (const file of files.sort()) {
          const output = bundle[file];
          if (output)
            digest.update(
              output.type === "chunk" ? output.code : output.source,
            );
        }
        const version = digest.digest("hex").slice(0, 16);
        const assets = files.map((file) => `/${file}`);
        this.emitFile({
          type: "asset",
          fileName: "service-worker.js",
          source: `
const CACHE = "dokuel-build-${version}";
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("dokuel-build-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(async () => {
      const cached = await (await caches.open(CACHE)).match("/index.html");
      return cached || Response.error();
    }));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE)).match(url.pathname);
      return cached || fetch(event.request);
    })());
  }
});
`,
        });
      },
    },
  };
}
