import { useCallback, useMemo, useState } from "react";
import {
  getPlayerId,
  getPlayerName,
  setPlayerName,
} from "../lib/player-identity.ts";
import type { Difficulty } from "../lib/types.ts";
import { MultiplayerGame } from "./MultiplayerGame.tsx";

export function MultiplayerScreen({
  roomId,
  difficulty,
  onBack,
}: {
  roomId: string;
  difficulty: Difficulty | null;
  onBack: () => void;
}) {
  const playerId = useMemo(getPlayerId, []);
  const [playerName, setName] = useState(getPlayerName);

  const handleRename = useCallback((name: string) => {
    setName(name);
    setPlayerName(name);
  }, []);

  return (
    <MultiplayerGame
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      onRename={handleRename}
      difficulty={difficulty}
      onBack={onBack}
    />
  );
}
