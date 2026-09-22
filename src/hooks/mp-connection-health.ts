import type { Connection } from "./mp-connection.ts";

export type ConnectionRole = "creator" | "joiner";

export type ConnectionHealthOptions = {
  playerId: string;
  role: ConnectionRole;
  /** When the open started, on the same clock as `now`. */
  openedAt: number;
  now: () => number;
};

export function watchConnectionHealth(
  _connection: Connection,
  _options: ConnectionHealthOptions,
): () => void {
  return () => {};
}
