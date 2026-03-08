import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { formatTime } from "../lib/format.ts";
import { saveGameResult } from "../lib/stats.ts";
import { generatePuzzle } from "../lib/sudoku.ts";
import type { Difficulty } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";

const EMPTY_CONFLICTS = new Set<number>();

type SoloGameProps = {
  difficulty: Difficulty;
  showConflicts?: boolean;
  initialPuzzle?: string;
  title?: string;
  onBack: () => void;
  onRematch?: () => void;
};

export function SoloGame({
  difficulty,
  showConflicts = true,
  initialPuzzle,
  title,
  onBack,
  onRematch,
}: SoloGameProps) {
  const puzzle = useMemo(() => {
    if (initialPuzzle) {
      return initialPuzzle;
    }
    return generatePuzzle(difficulty);
  }, [difficulty, initialPuzzle]);

  const game = useSudoku(puzzle);
  const { position, setPosition } = useNumPadPosition();
  const timerSecondsRef = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (game.status !== "completed") return;
    saveGameResult(difficulty, timerSecondsRef.current, true);
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [game.status, difficulty]);

  const handleNumber = (n: number) => {
    if (game.selectedCell) {
      game.placeNumber(n);
    }
  };

  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onPlaceNumber: handleNumber,
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing",
  });

  return (
    <GameLayout
      onBack={onBack}
      title={title}
      position={position}
      onPositionChange={setPosition}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      timer={
        <Timer
          running={game.status === "playing"}
          onTick={(s) => {
            timerSecondsRef.current = s;
          }}
        />
      }
      numPad={
        <NumPad
          position={position}
          remainingCounts={game.remainingCounts}
          onNumber={handleNumber}
        />
      }
      board={
        <Board
          board={game.board}
          selectedCell={game.selectedCell}
          conflicts={showConflicts ? game.conflicts : EMPTY_CONFLICTS}
          onSelectCell={game.selectCell}
          animateReveal={!revealed}
        />
      }
      controls={
        <GameControls
          notesMode={game.notesMode}
          onToggleNotes={game.toggleNotesMode}
          onErase={game.erase}
          onUndo={game.undo}
        />
      }
      footer={
        showResult ? (
          <GameResult
            isWinner={true}
            time={formatTime(timerSecondsRef.current)}
            onNewGame={onBack}
            onRematch={onRematch}
          />
        ) : undefined
      }
    />
  );
}
