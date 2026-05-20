import { useEffect, useMemo, useRef, useState } from "react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useDigitHighlight } from "../hooks/useDigitHighlight.ts";
import { useGameDigitDrag } from "../hooks/useGameDigitDrag.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useOpponentProgressVisible } from "../hooks/useOpponentProgressVisible.ts";
import { useRecordMultiplayerMatch } from "../hooks/useRecordMultiplayerMatch.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { serializeBoard } from "../lib/board-engine.ts";
import { formatTime } from "../lib/format.ts";
import { deleteGame, loadGame, saveGame } from "../lib/game-storage.ts";
import { solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel, Cell } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { MultiplayerHeaderExtra } from "./MultiplayerHeaderExtra.tsx";
import { NumPad } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

const EMPTY_CONFLICTS = new Set<number>();

export type MultiplayerBoardProps = {
  roomId: string;
  puzzle: string;
  /**
   * Monotonic counter from the Yjs room; bumps on every new puzzle
   * (start or rematch). Drives the in-place board reset that replaces
   * the old `key={puzzle}` remount trick.
   */
  gameNumber: number;
  playerId: string;
  difficulty: import("../lib/types.ts").Difficulty;
  assistLevel?: AssistLevel;
  /** Resolved at render time from the room's player list. Empty string is
   *  tolerated for the rare case of a winner-without-known-opponent. */
  opponentName: string;
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
};

export function MultiplayerBoard({
  roomId,
  puzzle,
  gameNumber,
  playerId,
  difficulty,
  assistLevel = "standard",
  opponentName,
  opponentProgress,
  opponentDisconnected,
  gameOver,
  onProgress,
  onComplete,
  onRematch,
  onBack,
}: MultiplayerBoardProps) {
  // Scope the autosave key by room + puzzle so a rematch in the same room
  // gets a fresh slate, and a different room never restores stale data.
  const gameKey = useMemo(
    () => `mp_${roomId}_${puzzle.slice(0, 12)}`,
    [roomId, puzzle],
  );
  const saved = useMemo(() => loadGame(gameKey), [gameKey]);
  const savedBoard = useMemo(
    () => (saved ? { values: saved.values, notes: saved.notes } : undefined),
    [saved],
  );
  const solution = useMemo(() => solvePuzzle(puzzle), [puzzle]);
  const game = useSudoku(puzzle, solution, savedBoard);
  // On rematch, the Yjs room bumps gameNumber and assigns a new puzzle.
  // Reset the reducer in-place rather than remount the whole subtree:
  // keeps the timer ref, num-pad position, and any other UI state alive.
  const prevGameNumberRef = useRef(gameNumber);
  useEffect(() => {
    if (gameNumber === prevGameNumberRef.current) return;
    prevGameNumberRef.current = gameNumber;
    game.reset(puzzle, solution, savedBoard);
  }, [gameNumber, puzzle, solution, savedBoard, game.reset]);
  const { position, setPosition } = useNumPadPosition();
  const { visible: showOpponentProgress, toggle: toggleOpponentProgress } =
    useOpponentProgressVisible();
  const initialTimerSeconds = saved?.timer ?? 0;
  const timerSecondsRef = useRef(initialTimerSeconds);
  const prevCellsRef = useRef(game.cellsRemaining);
  const revealed = useDelayedFlag(true, 600);
  // The loser keeps playing after the opponent wins; only show the result
  // modal once they've actually finished their own board (or won themselves).
  const iWon = gameOver?.winnerId === playerId;
  const iFinished = iWon || game.status === "completed";
  const showResult = useDelayedFlag(iFinished, 300);

  const myPercent = useMemo(() => {
    const total = 81 - puzzle.split("").filter((c) => c !== ".").length;
    const filled = total - game.cellsRemaining;
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [game.cellsRemaining, puzzle]);

  // Send progress when cells change
  useEffect(() => {
    if (prevCellsRef.current !== game.cellsRemaining) {
      prevCellsRef.current = game.cellsRemaining;
      const total = 81 - puzzle.split("").filter((c) => c !== ".").length;
      const filled = total - game.cellsRemaining;
      const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
      onProgress(game.cellsRemaining, percent);
    }
  }, [game.cellsRemaining, onProgress, puzzle]);

  // Check completion
  useEffect(() => {
    if (game.status !== "completed") return;
    onComplete(puzzle);
  }, [game.status, onComplete, puzzle]);

  // Autosave the local board so a transient unmount/remount or page
  // refresh doesn't wipe in-flight progress. The Yjs doc only carries
  // the puzzle + opponent progress; the filled cells live here.
  useEffect(() => {
    if (game.status === "completed") return;
    const { values, notes } = serializeBoard(game.board as Cell[][]);
    saveGame(gameKey, {
      puzzle,
      values,
      notes,
      timer: timerSecondsRef.current,
      difficulty,
      assistLevel,
    });
  }, [game.board, game.status, gameKey, puzzle, difficulty, assistLevel]);

  // Clear the save once this player finishes — keyed off local status so
  // the loser's in-progress save survives the opponent's win.
  useEffect(() => {
    if (game.status === "completed") deleteGame(gameKey);
  }, [game.status, gameKey]);

  useRecordMultiplayerMatch({
    gameOver,
    roomId,
    gameNumber,
    difficulty,
    assistLevel,
    playerId,
    opponentName,
    getTimeSeconds: () => timerSecondsRef.current,
  });

  // Touch numpad: tap is the cheap, frequent action (note); hold is the
  // deliberate commit (value). Keyboard digit (if focused) still follows
  // the in-reducer notesMode flag via useSudoku's default behavior.
  const [chargingDigit, setChargingDigit] = useState<number | null>(null);
  // With no cell selected, the numpad doubles as a filter chip.
  const highlight = useDigitHighlight(game);
  // Defer note-deselect to press end so a tap+hold can still commit
  // the digit on the originally selected cell.
  const holdFiredRef = useRef(false);
  const handleTapNote = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", true);
      setChargingDigit(n);
      holdFiredRef.current = false;
    } else {
      highlight.toggle(n);
    }
  };

  const handleHoldValue = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", false);
      holdFiredRef.current = true;
    }
  };

  const handlePressEnd = () => {
    setChargingDigit(null);
    if (!holdFiredRef.current) game.deselectCell();
    holdFiredRef.current = false;
  };

  // Digit drag-and-drop: drop commits the value, mirroring solo play.
  // Keyed off local status only — the loser keeps interacting until they
  // finish their own board.
  const { dragState, startNumpadDrag, startCellDrag } = useGameDigitDrag({
    game,
    disabled: game.status !== "playing",
    autoEliminateNotes: assistLevel !== "paper",
    onHighlightDigit: highlight.setDigit,
  });

  return (
    <GameLayout
      onBack={onBack}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={highlight.deselectCell}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      timer={
        <div className="flex flex-col items-center px-4 py-1.5 rounded-2xl bg-surface border border-border-default shadow-sm">
          <Timer
            running={game.status === "playing"}
            initialSeconds={initialTimerSeconds}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
            className="font-mono text-lg font-bold tabular-nums text-text-primary leading-none"
          />
          <span className="text-[0.6875rem] text-text-muted font-mono tabular-nums mt-0.5">
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
          remainingCounts={game.remainingCounts}
          selectedValue={
            game.selectedCell
              ? game.board[game.selectedCell.row]![game.selectedCell.col]!.value
              : highlight.highlightedDigit
          }
          showRemainingCounts={assistLevel === "full"}
          disableCompleted={assistLevel !== "paper"}
          onNumber={handleTapNote}
          onLongPressNumber={handleHoldValue}
          onPressEnd={handlePressEnd}
          onStartDrag={startNumpadDrag}
          onSkimDigit={highlight.setDigit}
        />
      }
      board={
        <>
          <Board
            board={game.board}
            selectedCell={game.selectedCell}
            selectedCells={game.selectedCells}
            assistLevel={assistLevel}
            conflicts={assistLevel !== "paper" ? game.errors : EMPTY_CONFLICTS}
            highlightedDigit={highlight.highlightedDigit}
            onSelectCell={highlight.selectCell}
            onSetSelectedCells={highlight.setSelectedCells}
            animateReveal={!revealed}
            chargingDigit={chargingDigit}
            dragState={dragState}
            onStartCellDrag={startCellDrag}
          />
          <DigitDragIndicator state={dragState} />
        </>
      }
      controls={
        <GameControls
          onErase={game.erase}
          onUndo={game.undo}
          historyLength={game.historyLength}
        />
      }
      settingsExtra={
        <ToggleSwitch
          checked={showOpponentProgress}
          onChange={toggleOpponentProgress}
          label="Opponent bar"
        />
      }
      headerExtra={
        <MultiplayerHeaderExtra
          gameOver={gameOver}
          iFinished={iFinished}
          showOpponentProgress={showOpponentProgress}
          opponentProgress={opponentProgress}
          opponentDisconnected={opponentDisconnected}
          myPercent={myPercent}
        />
      }
      footer={
        showResult && gameOver && iFinished ? (
          <GameResult
            isWinner={iWon}
            time={formatTime(timerSecondsRef.current)}
            difficulty={difficulty}
            isMultiplayer
            onNewGame={onBack}
            onRematch={onRematch}
          />
        ) : undefined
      }
    />
  );
}
