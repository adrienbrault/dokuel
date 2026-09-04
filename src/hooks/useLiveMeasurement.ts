import { useEffect, useRef } from "react";
import { trackProductEvent } from "../lib/product-events.ts";
import type { RoomState } from "../lib/types.ts";

export function useLiveMeasurement(
  roomId: string,
  playerId: string,
  room: Pick<RoomState, "gameNumber" | "startedAt" | "results"> | null,
  countdown: number,
) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!room?.startedAt || countdown > 0) return;
    const key = `${roomId}:${room.gameNumber}:${room.startedAt}`;
    if (!seen.current.has(key)) {
      seen.current.add(key);
      trackProductEvent("game_start", "live");
    }
    const result = room.results?.[playerId];
    if (result && !seen.current.has(`${key}:finished`)) {
      seen.current.add(`${key}:finished`);
      trackProductEvent(
        "game_complete",
        "live",
        Math.max(0, result.completedAt - room.startedAt) / 1000,
      );
    }
  }, [room, roomId, playerId, countdown]);
}
