/**
 * Error reporting over the anonymous telemetry channel
 * ({@link ./telemetry.ts}).
 */

import { track } from "./telemetry.ts";

export type ErrorSource = "window" | "rejection" | "boundary";

export type ErrorReporter = {
  report(error: unknown, source: ErrorSource): void;
};

// Mirrors the worker's limits for the "error" event.
const MAX_MESSAGE = 300;
const MAX_STACK = 2000;
const MAX_PATH = 100;

function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? "" };
  }
  return { message: String(error), stack: "" };
}

const DEFAULT_MAX_REPORTS = 10;

export function createErrorReporter({
  getPathname,
  maxReports = DEFAULT_MAX_REPORTS,
}: {
  getPathname: () => string;
  /** Distinct errors reported per page load before going quiet. */
  maxReports?: number;
}): ErrorReporter {
  // Keyed on source + message: the same throw from a render loop or a
  // failing interval is one report, however many times it fires.
  const seen = new Set<string>();
  return {
    report(error, source) {
      const { message, stack } = describe(error);
      const key = `${source}\n${message}`;
      if (seen.has(key) || seen.size >= maxReports) return;
      seen.add(key);
      track({
        name: "error",
        source,
        message: message.slice(0, MAX_MESSAGE),
        stack: stack.slice(0, MAX_STACK),
        path: routeTemplate(getPathname()).slice(0, MAX_PATH),
      });
    },
  };
}

export function installGlobalErrorReporting(
  _target: Window,
  _reporter: ErrorReporter,
): () => void {
  return () => {};
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
