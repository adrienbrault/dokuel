import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { TELEMETRY_EVENTS_URL } from "./hooks/mp-connection.ts";
import {
  sweepStaleRoomDatabases,
  sweepStaleSnapshots,
} from "./hooks/mp-snapshot.ts";
import {
  installGlobalErrorReporting,
  pageErrorReporter,
} from "./lib/error-reporting.ts";
import { generateId } from "./lib/id.ts";
import {
  createTelemetrySender,
  installTelemetry,
  resolveTelemetryEndpoint,
} from "./lib/telemetry.ts";

// Anonymous error and connection telemetry, deployed builds only. The
// session id is random per page load and never persisted, so events
// can be grouped within a visit but never tied to a player.
const telemetryEndpoint = resolveTelemetryEndpoint({
  override: import.meta.env.VITE_TELEMETRY_URL,
  prod: import.meta.env.PROD,
  hostname: window.location.hostname,
  defaultUrl: TELEMETRY_EVENTS_URL,
});
if (telemetryEndpoint) {
  installTelemetry(
    createTelemetrySender({
      endpoint: telemetryEndpoint,
      sessionId: generateId() + generateId(),
    }),
  );
  installGlobalErrorReporting(window, pageErrorReporter);
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Boot housekeeping, deferred off the startup path: drop room
// snapshots past their resume window and the y-indexeddb databases
// behind them. The delay keeps first paint clean and lands well after
// any live room has re-saved its own (fresh) snapshot.
setTimeout(() => {
  sweepStaleRoomDatabases(sweepStaleSnapshots());
}, 10_000);
