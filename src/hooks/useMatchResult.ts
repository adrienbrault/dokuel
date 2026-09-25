import { useMemo, useState } from "react";
import { getRoomScore } from "../lib/multiplayer-stats.ts";
import { useDelayedFlag } from "./useDelayedFlag.ts";

/**
 * When a multiplayer game's result is on screen. It opens for both
 * players the moment the game is decided, so the loser can go straight
 * to the rematch; a loser who would rather finish their board can set
 * it aside, and it comes back once they do.
 */
export function useMatchResult({
  roomId,
  gameNumber,
  decided,
  won,
  finished,
}: {
  roomId: string;
  gameNumber: number;
  decided: boolean;
  won: boolean;
  finished: boolean;
}) {
  const settled = useDelayedFlag(decided, 300);
  const [setAsideGame, setSetAsideGame] = useState<number | null>(null);
  const setAside = setAsideGame === gameNumber && !finished;
  const score = useMemo(
    () => getRoomScore(roomId, { gameNumber, won }),
    [roomId, gameNumber, won],
  );
  return {
    visible: settled && decided && !setAside,
    score,
    setAside: finished ? undefined : () => setSetAsideGame(gameNumber),
    bringBack: () => setSetAsideGame(null),
  };
}
