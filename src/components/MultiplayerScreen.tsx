import { useCallback, useMemo, useState } from "react";
import { generateId } from "../lib/id.ts";
import { generatePlayerName } from "../lib/name-generator.ts";
import type { Difficulty } from "../lib/types.ts";
import { MultiplayerGame } from "./MultiplayerGame.tsx";

// Storage access is guarded and the write happens best-effort: these
// run from render-phase initializers (identity must exist before the
// first render), so a throwing localStorage (blocked storage) must not
// crash the screen, and StrictMode's double render makes the writes
// idempotent by construction — the second pass reads the value the
// first one stored.
function getPlayerId() {
  try {
    let id = localStorage.getItem("sudoku_player_id");
    if (!id) {
      id = generateId();
      localStorage.setItem("sudoku_player_id", id);
    }
    return id;
  } catch {
    return generateId();
  }
}

function getPlayerName() {
  try {
    let name = localStorage.getItem("sudoku_player_name");
    if (!name) {
      name = generatePlayerName();
      localStorage.setItem("sudoku_player_name", name);
    }
    return name;
  } catch {
    return generatePlayerName();
  }
}

function persistPlayerName(name: string) {
  try {
    localStorage.setItem("sudoku_player_name", name);
  } catch {
    // Storage unavailable — the rename still applies for this session.
  }
}

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
    persistPlayerName(name);
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
