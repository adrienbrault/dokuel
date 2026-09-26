/**
 * The service worker's one decision, kept pure so it is testable
 * without a worker runtime: should it handle this request, and how?
 *
 * - "navigate": same-origin page load. Network first so a fresh
 *   deploy is picked up when online; cached shell when offline.
 * - "precached": a build file installed with this worker version.
 *   Cache first; hashed names make it immutable.
 * - "passthrough": everything else goes to the network untouched.
 *   Multiplayer (signaling, TURN credentials, telemetry) lives here.
 */
export type SwRoute = "navigate" | "precached" | "passthrough";

export type RoutableRequest = {
  url: string;
  method: string;
  mode: string;
};

// Same-origin paths that are APIs, not pages: a cached index.html in
// their place would be a silent, confusing failure.
const API_PREFIXES = ["/turn-credentials", "/events"];

function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function routeRequest(
  request: RoutableRequest,
  origin: string,
  precached: ReadonlySet<string>,
): SwRoute {
  if (request.method !== "GET") return "passthrough";
  const url = new URL(request.url);
  if (url.origin !== origin) return "passthrough";
  if (isApiPath(url.pathname)) return "passthrough";
  if (request.mode === "navigate") return "navigate";
  if (precached.has(url.pathname)) return "precached";
  return "passthrough";
}
