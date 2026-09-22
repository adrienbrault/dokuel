import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Plugin } from "vite";
import { precacheUrls } from "../src/lib/sw-precache.ts";

/**
 * Builds src/sw.ts as dist/sw.js and injects this build's precache
 * list and version. A hand-rolled alternative to vite-plugin-pwa /
 * workbox: the worker is ~100 lines and the only build-time job is
 * "list the emitted files", which does not justify a dependency tree.
 *
 * Build only: dev and vitest never see a service worker.
 */
const SW_ENTRY = "src/sw.ts";
const SW_FILE = "sw.js";
const PLACEHOLDER = "__SW_MANIFEST__";

type Contents = Map<string, string | Uint8Array>;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function readPublicDir(publicDir: string, into: Contents): void {
  if (!publicDir) return;
  for (const path of walk(publicDir)) {
    into.set(
      relative(publicDir, path).split("\\").join("/"),
      readFileSync(path),
    );
  }
}

// Any byte change in a precached file yields a new version, so the
// new worker installs, re-downloads and drops the old cache.
function buildManifest(contents: Contents) {
  const urls = precacheUrls([...contents.keys()]);
  const precached = new Set(urls);
  const hash = createHash("sha256");
  for (const name of [...contents.keys()].sort()) {
    const url = name === "index.html" ? "/" : `/${name}`;
    if (!precached.has(url)) continue;
    hash.update(url);
    hash.update(contents.get(name) ?? "");
  }
  return { version: hash.digest("hex").slice(0, 12), urls };
}

export function serviceWorkerPlugin(): Plugin {
  let publicDir = "";
  return {
    name: "dokuel-service-worker",
    apply: "build",
    // After Vite's own HTML plugin, so index.html is in the bundle.
    enforce: "post",
    config(config) {
      const root = config.root ?? process.cwd();
      return {
        build: {
          rollupOptions: {
            input: {
              index: resolve(root, "index.html"),
              sw: resolve(root, SW_ENTRY),
            },
            output: {
              entryFileNames: (chunk) =>
                chunk.name === "sw" ? SW_FILE : "assets/[name]-[hash].js",
            },
          },
        },
      };
    },
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const swChunk = bundle[SW_FILE];
      if (swChunk?.type !== "chunk" || !swChunk.code.includes(PLACEHOLDER)) {
        this.error(`${SW_FILE} missing or lacks ${PLACEHOLDER}`);
      }
      const contents: Contents = new Map();
      for (const [name, file] of Object.entries(bundle)) {
        contents.set(name, file.type === "chunk" ? file.code : file.source);
      }
      readPublicDir(publicDir, contents);
      if (!contents.has("index.html")) this.error("index.html not emitted");
      const manifest = JSON.stringify(buildManifest(contents));
      swChunk.code = swChunk.code.split(PLACEHOLDER).join(manifest);
    },
  };
}
