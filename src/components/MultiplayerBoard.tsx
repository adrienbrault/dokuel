import { useEffect, useMemo, useRef, useState } from "react";
import { useNumPadLayout } from "../hooks/useNumPadLayout.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useOpponentProgressVisible } from "../hooks/useOpponentProgressVisible.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { EMPTY_CONFLICTS } from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import { countFilledCells, solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout, type SettingItem } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { NumPadPositionIcon, OpponentBarIcon } from "./SettingIcons.tsx";
import { Timer } from "./Timer.tsx";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

export type MultiplayerBoardProps = {
  puzzle: string;
  playerId: string;
  difficulty: import("../lib/types.ts").Difficulty;
  assistLevel?: AssistLevel;
  opponentProgress: {
    cellsRemaining: number;
    completionPercent: number;
  } | null;
  opponentDisconnected: boolean;
  gameOver: { winnerId: string; winnerName: string } | null;
  onProgress: (cellsRemaining: number, completionPercent: number) => void;
  onComplete: (board: string) => void;
  onRematch: () => void;
  onBack: () => void;
  onAddFriend?:
    | ((opponentId: string, opponentName: string) => void)
    | undefined;
  opponentId?: string | undefined;
  opponentName?: string | undefined;
};

export function MultiplayerBoard({
  puzzle,
  playerId,
  difficulty,
  assistLevel = "standard",
  opponentProgress,
  opponentDisconnected,
  gameOver,
  onProgress,
  onComplete,
  onRematch,
  onBack,
  onAddFriend,
  opponentId,
  opponentName,
}: MultiplayerBoardProps) {
  const solution = useMemo(() => solvePuzzle(puzzle), [puzzle]);
  const game = useSudoku(puzzle, solution);
  const { position, setPosition } = useNumPadPosition();
  const numPadLayout = useNumPadLayout(position);
  const { visible: showOpponentProgress, toggle: toggleOpponentProgress } =
    useOpponentProgressVisible();
  const timerSecondsRef = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const prevCellsRef = useRef(game.cellsRemaining);
  const [revealed, setRevealed] = useState(false);

  const totalToFill = useMemo(() => 81 - countFilledCells(puzzle), [puzzle]);

  const myPercent = useMemo(() => {
    const filled = totalToFill - game.cellsRemaining;
    return totalToFill > 0 ? Math.round((filled / totalToFill) * 100) : 0;
  }, [game.cellsRemaining, totalToFill]);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, []);

  // Send progress when cells change
  useEffect(() => {
    if (prevCellsRef.current !== game.cellsRemaining) {
      prevCellsRef.current = game.cellsRemaining;
      onProgress(game.cellsRemaining, myPercent);
    }
  }, [game.cellsRemaining, onProgress, myPercent]);

  // Check completion
  useEffect(() => {
    if (game.status !== "completed") return;
    onComplete(puzzle);
  }, [game.status, onComplete, puzzle]);

  // Show result on game over
  useEffect(() => {
    if (!gameOver) return;
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [gameOver]);

  const handleNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper");
    }
  };

  const settings: SettingItem[] = [
    {
      key: "position",
      label: "Numpad position",
      icon: <NumPadPositionIcon position={position} />,
      content: (
        <NumPadPositionToggle position={position} onChange={setPosition} />
      ),
    },
    {
      key: "opponent",
      label: "Opponent bar",
      icon: <OpponentBarIcon visible={showOpponentProgress} />,
      content: (
        <ToggleSwitch
          checked={showOpponentProgress}
          onChange={toggleOpponentProgress}
          label="Opponent bar"
        />
      ),
    },
  ];

  return (
    <GameLayout
      onBack={onBack}
      position={position}
      onDeselectCell={game.deselectCell}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      settings={settings}
      timer={
        <div className="flex flex-col items-center">
          <Timer
            running={!gameOver}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
          />
          <span className="text-xs text-text-muted font-mono tabular-nums">
            <span className="text-accent font-medium">
              {81 - game.cellsRemaining}
            </span>
            /81
          </span>
        </div>
      }
      numPad={
        <NumPad
          position={position}
          layout={numPadLayout}
          remainingCounts={game.remainingCounts}
          selectedValue={
            game.selectedCell
              ? (game.board[game.selectedCell.row]?.[game.selectedCell.col]
                  ?.value ?? null)
              : null
          }
          showRemainingCounts={assistLevel === "full"}
          disableCompleted={assistLevel !== "paper"}
          onNumber={handleNumber}
        />
      }
      board={
        <Board
          board={game.board}
          selectedCell={game.selectedCell}
          selectedCells={game.selectedCells}
          assistLevel={assistLevel}
          conflicts={assistLevel !== "paper" ? game.errors : EMPTY_CONFLICTS}
          onSelectCell={game.selectCell}
          onSetSelectedCells={game.setSelectedCells}
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
      headerExtra={
        showOpponentProgress && opponentProgress ? (
          <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-1.5">
            <ProgressBar label="You" percent={myPercent} color="bg-accent" />
            <ProgressBar
              label={
                opponentDisconnected ? "Opponent (reconnecting...)" : "Opponent"
              }
              percent={opponentProgress.completionPercent}
              color="bg-rose-400"
            />
          </div>
        ) : undefined
      }
      footer={
        showResult && gameOver ? (
          <GameResult
            isWinner={gameOver.winnerId === playerId}
            time={formatTime(timerSecondsRef.current)}
            difficulty={difficulty}
            isMultiplayer
            onNewGame={onBack}
            onRematch={onRematch}
            onAddFriend={onAddFriend}
            opponentId={opponentId}
            opponentName={opponentName}
          />
        ) : undefined
      }
    />
  );
}

function ProgressBar({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary w-24 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-bg-raised overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary font-mono tabular-nums w-8 text-right">
        {percent}%
      </span>
    </div>
  );
}
