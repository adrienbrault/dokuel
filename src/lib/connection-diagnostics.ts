export type ConnectionStage =
  | "opening"
  | "relay-ready"
  | "stun-only"
  | "transport-started"
  | "restored"
  | "peer-reachable"
  | "peer-missing"
  | "suspended"
  | "closed"
  | "failed";
export type ConnectionDiagnostic = {
  stage: ConnectionStage;
  milliseconds: number;
};
const EMPTY: readonly ConnectionDiagnostic[] = [];
let active: {
  room: string;
  token: symbol;
  entries: readonly ConnectionDiagnostic[];
} | null = null;
const listeners = new Set<() => void>();

/** Memory only: no room codes, credentials, or IPs leave the device. */
export function beginConnectionDiagnostics(room: string) {
  const token = Symbol();
  const started = performance.now();
  active = { room, token, entries: EMPTY };
  const record = (stage: ConnectionStage) => {
    if (active?.token !== token || active.entries.at(-1)?.stage === stage)
      return;
    active.entries = [
      ...active.entries,
      { stage, milliseconds: Math.round(performance.now() - started) },
    ].slice(-20);
    for (const listener of listeners) listener();
  };
  record("opening");
  return record;
}
export function getConnectionDiagnostics(
  room: string,
): readonly ConnectionDiagnostic[] {
  return active?.room === room ? active.entries : EMPTY;
}
export function subscribeConnectionDiagnostics(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
