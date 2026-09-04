import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useElapsedClock } from "../hooks/useElapsedClock.ts";
import { useFlushOnExit } from "../hooks/useFlushOnExit.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useNumpadInteractions } from "../hooks/useNumpadInteractions.ts";
import { useOpponentProgressVisible } from "../hooks/useOpponentProgressVisible.ts";
import { useRecordMultiplayerMatch } from "../hooks/useRecordMultiplayerMatch.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { serializeBoard } from "../lib/board-engine.ts";
import { formatTime } from "../lib/format.ts";
import {
  deleteGame,
  loadMultiplayerGame,
  multiplayerGameKey,
  saveMultiplayerGame,
} from "../lib/game-storage.ts";
import type { AssistLevel, Cell } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { MultiplayerHeaderExtra } from "./MultiplayerHeaderExtra.tsx";
import { NumPad } from "./NumPad.tsx";
import { TimerPill } from "./TimerPill.tsx";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

const EMPTY_CONFLICTS = new Set<number>();

export type MultiplayerBoardProps = {
  roomId: string;
  puzzle: string;
  /** Room-owned solution; null for legacy snapshots. */
  solution: string | null;
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
  rematchReady?: string[] | undefined;
  onBack: () => void;
  /** Injected monotonic clock for deterministic duration tests. */
  now?: (() => number) | undefined;
};

export function MultiplayerBoard({
  roomId,
  puzzle,
  solution,
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
  rematchReady = [],
  onBack,
  now,
}: MultiplayerBoardProps) {
  const identity = useMemo(
    () => ({ roomId, playerId, gameNumber, puzzle }),
    [roomId, playerId, gameNumber, puzzle],
  );
  const gameKey = multiplayerGameKey(identity);
  const saved = useMemo(() => loadMultiplayerGame(identity), [identity]);
  const savedBoard = useMemo(
    () => (saved ? { values: saved.values, notes: saved.notes } : undefined),
    [saved],
  );
  const game = useSudoku(puzzle, solution ?? undefined, savedBoard);
  // On rematch, the Yjs room bumps gameNumber and assigns a new puzzle.
  // Reset the reducer in-place rather than remount the whole subtree:
  // keeps the timer ref, num-pad position, and any other UI state alive.
  // The puzzle is tracked too: after a concurrent start/rematch merge
  // the number can stay put while the puzzle changes under us.
  const prevGameNumberRef = useRef(gameNumber);
  const prevPuzzleRef = useRef(puzzle);
  const changingGame =
    gameNumber !== prevGameNumberRef.current ||
    puzzle !== prevPuzzleRef.current;
  useEffect(() => {
    if (!changingGame) return;
    prevGameNumberRef.current = gameNumber;
    prevPuzzleRef.current = puzzle;
    game.reset(puzzle, solution ?? undefined, savedBoard);
  }, [changingGame, gameNumber, puzzle, solution, savedBoard, game.reset]);
  const { position, setPosition } = useNumPadPosition();
  const { visible: showOpponentProgress, toggle: toggleOpponentProgress } =
    useOpponentProgressVisible();
  const elapsedClock = useElapsedClock({
    running: game.status === "playing",
    initialSeconds: saved?.timer ?? 0,
    resetKey: gameKey,
    // A live duel must include time while this tab is backgrounded or the
    // browser suspends performance callbacks. Solo passes its monotonic
    // clock separately because active-play time there pauses when hidden.
    now: now ?? Date.now,
  });
  const elapsedSeconds = elapsedClock.getElapsedSeconds();
  const prevCellsRef = useRef(game.cellsRemaining);
  const revealed = useDelayedFlag(true, 600);
  // The loser keeps playing after the opponent wins; only show the result
  // modal once they've actually finished their own board (or won themselves).
  const rematchRequested = rematchReady.includes(playerId);
  const opponentRequested = rematchReady.some((id) => id !== playerId);
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
      onProgress(game.cellsRemaining, myPercent);
    }
  }, [game.cellsRemaining, onProgress, myPercent]);

  // Check completion — the claim ships the actual filled board so the
  // opponent's client can verify it against the room's solution.
  useEffect(() => {
    if (changingGame || game.status !== "completed") return;
    onComplete(serializeBoard(game.board as Cell[][]).values);
  }, [changingGame, game.status, game.board, onComplete]);

  // Autosave the local board so a transient unmount/remount or page
  // refresh doesn't wipe in-flight progress. The Yjs doc only carries
  // the puzzle + opponent progress; the filled cells live here.
  const persist = useCallback(() => {
    if (changingGame || game.status === "completed") return;
    // On rematch this effect and the RESET dispatch share a commit: the
    // reducer still holds the OLD game's board while gameKey already
    // points at the new one. Writing that mix would resume game 2
    // wearing game 1's cells if the tab dies before the next render.
    const boardMatchesPuzzle = game.board.every((boardRow, r) =>
      boardRow.every((boardCell, c) => {
        const ch = puzzle[r * 9 + c];
        return ch === "."
          ? !boardCell.isGiven
          : boardCell.isGiven && boardCell.value === Number(ch);
      }),
    );
    if (!boardMatchesPuzzle) return;
    const { values, notes } = serializeBoard(game.board as Cell[][]);
    saveMultiplayerGame(identity, {
      puzzle,
      values,
      notes,
      timer: elapsedClock.getElapsedSeconds(),
      difficulty,
      assistLevel,
      hintsUsed: game.hintsUsed,
    });
  }, [
    game.board,
    game.status,
    game.hintsUsed,
    identity,
    changingGame,
    puzzle,
    difficulty,
    assistLevel,
    elapsedClock.getElapsedSeconds,
  ]);
  useEffect(persist, [persist]);
  useFlushOnExit(persist);

  // Clear the save once this player finishes — keyed off local status so
  // the loser's in-progress save survives the opponent's win.
  useEffect(() => {
    if (!changingGame && game.status === "completed") deleteGame(gameKey);
  }, [changingGame, game.status, gameKey]);

  useRecordMultiplayerMatch({
    gameOver,
    roomId,
    gameNumber,
    difficulty,
    assistLevel,
    playerId,
    opponentName,
    getTimeSeconds: elapsedClock.getElapsedSeconds,
  });

  // Keyed off local status only — the loser keeps interacting until they
  // finish their own board.
  const {
    highlight,
    chargingDigit,
    numPadRef,
    numPadProps,
    dragState,
    startCellDrag,
  } = useNumpadInteractions({
    game,
    disabled: game.status !== "playing",
    assistLevel,
  });

  return (
    <GameLayout
      onBack={onBack}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={highlight.deselectCell}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      timer={
        <TimerPill
          seconds={elapsedClock.seconds}
          subline={
            <>
              <span className="text-accent font-medium">
                {81 - game.cellsRemaining}
              </span>
              /81
            </>
          }
        />
      }
      numPad={<NumPad ref={numPadRef} position={position} {...numPadProps} />}
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
          notesMode={game.notesMode}
          onToggleNotes={game.toggleNotesMode}
          disabled={game.status !== "playing" || changingGame}
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
          onAcceptRematch={opponentRequested ? onRematch : undefined}
        />
      }
      footer={
        showResult && gameOver && iFinished ? (
          <GameResult
            isWinner={iWon}
            time={formatTime(elapsedSeconds)}
            difficulty={difficulty}
            isMultiplayer
            rematchState={
              rematchRequested
                ? "requested"
                : opponentRequested
                  ? "offered"
                  : undefined
            }
            onNewGame={onBack}
            onRematch={onRematch}
          />
        ) : undefined
      }
    />
  );
}
