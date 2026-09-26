/**
 * Offline service worker. Built as its own entry (see
 * scripts/vite-sw-plugin.ts), which swaps __SW_MANIFEST__ for this
 * build's version and precache list.
 *
 * Only the app shell is cached. Multiplayer traffic is never touched:
 * see routeRequest for the exact rules.
 */
import { routeRequest } from "./lib/sw-routing.ts";

declare const __SW_MANIFEST__: { version: string; urls: string[] };

// The WebWorker lib clashes with the DOM lib the rest of src/ is
// checked against, so describe just the worker surface used here.
type ExtendableEvent = Event & { waitUntil(p: Promise<unknown>): void };
type FetchEvent = ExtendableEvent & {
  request: Request;
  respondWith(r: Promise<Response>): void;
};
type WorkerScope = {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(
    type: "install" | "activate",
    fn: (e: ExtendableEvent) => void,
  ): void;
  addEventListener(type: "fetch", fn: (e: FetchEvent) => void): void;
  addEventListener(
    type: "message",
    fn: (e: MessageEvent<unknown>) => void,
  ): void;
};

const sw = self as unknown as WorkerScope;
const CACHE_PREFIX = "dokuel-shell-";
// Referenced once: the build pastes the whole manifest literal here.
const MANIFEST = __SW_MANIFEST__;
const CACHE_NAME = `${CACHE_PREFIX}${MANIFEST.version}`;
const PRECACHED = new Set(MANIFEST.urls);
// A connection that is up but not delivering ("lie-fi") would
// otherwise hang every page load; after this the cached shell wins.
const NAVIGATION_TIMEOUT_MS = 4000;

sw.addEventListener("install", (event) => {
  // No skipWaiting here: an update waits until the player chooses to
  // reload, so a running game never swaps code underneath itself.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...PRECACHED])),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("message", (event) => {
  const data = event.data as { type?: unknown } | null;
  if (data?.type === "SKIP_WAITING") void sw.skipWaiting();
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const route = routeRequest(request, sw.location.origin, PRECACHED);
  if (route === "navigate") event.respondWith(networkFirst(request));
  else if (route === "precached") event.respondWith(cacheFirst(request));
});

async function networkFirst(request: Request): Promise<Response> {
  try {
    return await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS);
  } catch (err) {
    // Every SPA route renders from the same shell. It is deliberately
    // never refreshed from a navigation: the cached shell must keep
    // pointing at the assets cached alongside it.
    const shell = await caches.match("/", { cacheName: CACHE_NAME });
    if (shell) return shell;
    throw err;
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const url = new URL(request.url).pathname;
  const cached = await caches.match(url, { cacheName: CACHE_NAME });
  return cached ?? fetch(request);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
