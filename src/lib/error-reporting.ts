/**
 * Error reporting over the anonymous telemetry channel
 * ({@link ./telemetry.ts}).
 */

export type ErrorSource = "window" | "rejection" | "boundary";

export type ErrorReporter = {
  report(error: unknown, source: ErrorSource): void;
};

export function createErrorReporter(_options: {
  getPathname: () => string;
}): ErrorReporter {
  return { report() {} };
}

const STATIC_ROUTES = new Set(["daily", "join", "stats"]);

/**
 * The route shape of a path, with anything identifying replaced by a
 * placeholder: a room code is effectively a shared secret for its
 * match, and a solo game key is noise. Mirrors the shapes App.tsx
 * routes on without depending on it.
 */
export function routeTemplate(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const [first, second] = segments;
  if (first === undefined) return "/";
  if (segments.length === 1 && STATIC_ROUTES.has(first)) return `/${first}`;
  if (first === "solo" && segments.length === 3) {
    return `/solo/${second}/:game`;
  }
  return segments.length === 1 ? "/:room" : "/:other";
}
