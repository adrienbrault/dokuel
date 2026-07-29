import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import {
  sweepStaleRoomDatabases,
  sweepStaleSnapshots,
} from "./hooks/mp-snapshot.ts";

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
