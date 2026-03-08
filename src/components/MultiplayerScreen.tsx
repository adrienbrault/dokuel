import { useCallback, useMemo, useState } from "react";
import { generatePlayerName } from "../lib/name-generator.ts";
import type { Difficulty } from "../lib/types.ts";
import { MultiplayerGame } from "./MultiplayerGame.tsx";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getPlayerId() {
  let id = localStorage.getItem("sudoku_player_id");
  if (!id) {
    id = sessionStorage.getItem("sudoku_player_id");
    if (!id) {
      id = generateId();
    }
    localStorage.setItem("sudoku_player_id", id);
  }
  return id;
}

function getPlayerName() {
  let name = localStorage.getItem("sudoku_player_name");
  if (!name) {
    name = sessionStorage.getItem("sudoku_player_name");
    if (!name) {
      name = generatePlayerName();
    }
    localStorage.setItem("sudoku_player_name", name);
  }
  return name;
}

function persistPlayerName(name: string) {
  localStorage.setItem("sudoku_player_name", name);
}

export function MultiplayerScreen({
  roomId,
  difficulty,
  showConflicts,
  onBack,
}: {
  roomId: string;
  difficulty: Difficulty;
  showConflicts: boolean;
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
      showConflicts={showConflicts}
      onBack={onBack}
    />
  );
}
