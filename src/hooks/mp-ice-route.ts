import type { IceRoute } from "./mp-connection.ts";

/**
 * Which ICE candidate types a peer connection is actually using, read
 * from `RTCPeerConnection.getStats()`. "relay" on either side means
 * traffic goes through TURN; anything else is a direct path.
 */

type StatsEntry = Record<string, unknown>;

function findSelectedPair(
  byId: Map<string, StatsEntry>,
): StatsEntry | undefined {
  const entries = [...byId.values()];
  // Chromium and Safari point at the pair in use from the transport.
  for (const entry of entries) {
    if (entry.type !== "transport") continue;
    const pair = byId.get(entry.selectedCandidatePairId as string);
    if (pair) return pair;
  }
  // Firefox flags the pair itself; older engines only mark the
  // nominated pair that succeeded.
  return (
    entries.find(
      (entry) => entry.type === "candidate-pair" && entry.selected === true,
    ) ??
    entries.find(
      (entry) =>
        entry.type === "candidate-pair" &&
        entry.nominated === true &&
        entry.state === "succeeded",
    )
  );
}

export function selectedIceRoute(stats: RTCStatsReport): IceRoute | null {
  const byId = new Map<string, StatsEntry>();
  stats.forEach((entry: StatsEntry) => {
    byId.set(entry.id as string, entry);
  });
  const pair = findSelectedPair(byId);
  if (!pair) return null;
  const local = byId.get(pair.localCandidateId as string)?.candidateType;
  const remote = byId.get(pair.remoteCandidateId as string)?.candidateType;
  if (typeof local !== "string" || typeof remote !== "string") return null;
  return { local, remote };
}
