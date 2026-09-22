import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import {
  sweepStaleRoomDatabases,
  sweepStaleSnapshots,
} from "./hooks/mp-snapshot.ts";
import { registerServiceWorker } from "./lib/sw-updates.ts";

// Production only: dev serves unbundled modules the worker knows
// nothing about, and sw.js is only emitted by `vite build`. Deferred
// to "load" so precaching never competes with first paint.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void registerServiceWorker(navigator.serviceWorker);
  });
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
