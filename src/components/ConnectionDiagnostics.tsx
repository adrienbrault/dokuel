import { useSyncExternalStore } from "react";
import {
  type ConnectionStage,
  getConnectionDiagnostics,
  subscribeConnectionDiagnostics,
} from "../lib/connection-diagnostics.ts";

const LABELS: Record<ConnectionStage, string> = {
  opening: "Preparing local recovery and relay settings",
  "relay-ready": "Relay configured; direct connections are still preferred",
  "stun-only": "Relay unavailable; some mobile networks may not connect",
  "transport-started": "Peer discovery started",
  restored: "Local room history restored",
  "peer-reachable": "Friend is reachable",
  "peer-missing": "Waiting for your friend to connect",
  suspended: "Connection paused while away",
  closed: "Connection closed",
  failed: "Connection setup failed",
};

export function ConnectionDiagnostics({ roomId }: { roomId: string }) {
  const entries = useSyncExternalStore(subscribeConnectionDiagnostics, () =>
    getConnectionDiagnostics(roomId),
  );
  return (
    <details className="card p-3 w-full max-w-sm text-sm text-text-secondary">
      <summary className="cursor-pointer">Connection details</summary>
      <p className="caption mt-2">
        This report stays on your device. Both players need to keep Dokuel open
        while joining.
      </p>
      <ol className="flex flex-col gap-2 mt-3">
        {entries.map((entry, index) => (
          <li key={`${entry.stage}-${entry.milliseconds}-${index}`}>
            <span className="font-mono text-text-muted">
              {(entry.milliseconds / 1000).toFixed(1)}s
            </span>{" "}
            {LABELS[entry.stage]}
          </li>
        ))}
      </ol>
    </details>
  );
}
