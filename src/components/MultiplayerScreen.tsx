import { useCallback, useMemo, useState } from "react";
import { useAssistLevel } from "../hooks/useAssistLevel.ts";
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
  // Only read when this client is the creator: the room it opens starts
  // on the assistance the player already chose for themselves, and the
  // lobby's own selector takes over from there.
  const { level: assistLevel } = useAssistLevel();

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
      assistLevel={assistLevel}
      onBack={onBack}
    />
  );
}
