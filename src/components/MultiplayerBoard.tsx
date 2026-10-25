import { useEffect, useMemo, useRef } from "react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useMatchResult } from "../hooks/useMatchResult.ts";
import { useMultiplayerAutosave } from "../hooks/useMultiplayerAutosave.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useNumpadInteractions } from "../hooks/useNumpadInteractions.ts";
import { useOpponentProgressVisible } from "../hooks/useOpponentProgressVisible.ts";
import { useRaceReporting } from "../hooks/useRaceReporting.ts";
import { useRecordMultiplayerMatch } from "../hooks/useRecordMultiplayerMatch.ts";
import { useReplayRecorder } from "../hooks/useReplayRecorder.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { type TeamPlay, useTeamBoardSync } from "../hooks/useTeamBoardSync.ts";
import { formatTime } from "../lib/format.ts";
import { loadGame, MULTIPLAYER_KEY_PREFIX } from "../lib/game-storage.ts";
import type { AssistLevel, DigitStyle } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import type { NextGame } from "./MatchResult.tsx";
import type { OpponentBar } from "./MultiplayerHeaderExtra.tsx";
import { MultiplayerHeaderExtra } from "./MultiplayerHeaderExtra.tsx";
import {
  MultiplayerResult,
  matchReplay,
  type ReplaySource,
} from "./MultiplayerResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { TimerPill } from "./TimerPill.tsx";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

const EMPTY_CONFLICTS = new Set<number>();

export type MultiplayerBoardProps = {
  roomId: string;
  puzzle: string;
  /**
   * The puzzle's solution, computed once when the game started and
   * carried in the Yjs room. Authoritative for error highlighting —
   * never recomputed locally, because the solver picks a random valid
   * solution for non-unique puzzles, so a reload would otherwise flip
   * correct digits to red. Null only for pre-existing games restored
   * from an older snapshot that predates this field.
   */
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
  /** Everyone else in the room, in seat order. */
  opponents: OpponentBar[];
  opponentDisconnected: boolean;
  gameOver: { winnerId: string; winnerName: string } | null;
  /** The palette the room pins for both boards, null when each keeps
   *  their own. */
  digitStyle?: DigitStyle | null | undefined;
  /** Host only: changing the pinned palette mid-game. */
  onDigitStyleChange?: ((style: DigitStyle) => void) | undefined;
  /** The room's side of the match replay; omitted, there is none. */
  replay?: ReplaySource | undefined;
  onProgress: (cellsRemaining: number, completionPercent: number) => void;
  onComplete: (board: string) => void;
  /** The room's side of the rematch the result offers. */
  next: NextGame;
  /** In a teams game: our shared board and who we share it with. */
  team?: TeamPlay | undefined;
  onBack: () => void;
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
  opponents,
  opponentDisconnected,
  gameOver,
  digitStyle,
  onDigitStyleChange,
  replay,
  onProgress,
  onComplete,
  next,
  team,
  onBack,
}: MultiplayerBoardProps) {
  // Scope the autosave key by room + puzzle so a rematch in the same room
  // gets a fresh slate, and a different room never restores stale data.
  const gameKey = useMemo(
    () => `${MULTIPLAYER_KEY_PREFIX}${roomId}_${puzzle.slice(0, 12)}`,
    [roomId, puzzle],
  );
  const saved = useMemo(() => loadGame(gameKey), [gameKey]);
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
  useEffect(() => {
    if (
      gameNumber === prevGameNumberRef.current &&
      puzzle === prevPuzzleRef.current
    ) {
      return;
    }
    prevGameNumberRef.current = gameNumber;
    prevPuzzleRef.current = puzzle;
    game.reset(puzzle, solution ?? undefined, savedBoard);
    // The new game starts from zero; without this the recorded match
    // time for game 2 includes game 1's clock.
    timerSecondsRef.current = 0;
  }, [gameNumber, puzzle, solution, savedBoard, game.reset]);
  const { position, setPosition } = useNumPadPosition();
  const { visible: showOpponentProgress, toggle: toggleOpponentProgress } =
    useOpponentProgressVisible();
  const initialTimerSeconds = saved?.timer ?? 0;
  const timerSecondsRef = useRef(initialTimerSeconds);
  const revealed = useDelayedFlag(true, 600);
  const iWon =
    gameOver !== null &&
    (gameOver.winnerId === playerId ||
      !!team?.allies.includes(gameOver.winnerId));
  const iFinished = iWon || game.status === "completed";
  const result = useMatchResult({
    roomId,
    gameNumber,
    decided: gameOver !== null,
    won: iWon,
    finished: iFinished,
  });

  useTeamBoardSync(game, team);

  const myPercent = useRaceReporting({
    puzzle,
    board: game.board,
    status: game.status,
    cellsRemaining: game.cellsRemaining,
    onProgress,
    onComplete,
  });

  useMultiplayerAutosave({
    gameKey,
    puzzle,
    board: game.board,
    status: game.status,
    hintsUsed: game.hintsUsed,
    timerSecondsRef,
    difficulty,
    assistLevel,
  });

  // Recorded from the first move, shared only once the game is over:
  // a live replay would show the opponent our board mid-race.
  useReplayRecorder({
    puzzle,
    board: game.board,
    gameNumber,
    startOffsetMs: initialTimerSeconds * 1000,
    share: gameOver !== null && replay !== undefined,
    onShare: (frames) => replay?.share(frames),
  });

  useRecordMultiplayerMatch({
    // Co-op is no duel: nothing to add to the head-to-head history.
    gameOver: team?.coop ? null : gameOver,
    roomId,
    gameNumber,
    difficulty,
    assistLevel,
    playerId,
    allies: team?.allies,
    opponentName,
    getTimeSeconds: () => timerSecondsRef.current,
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
      digitStyle={digitStyle}
      onDigitStyleChange={onDigitStyleChange}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={highlight.deselectCell}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      timer={
        <TimerPill
          timerKey={gameNumber}
          running={game.status === "playing"}
          initialSeconds={initialTimerSeconds}
          onTick={(s) => {
            timerSecondsRef.current = s;
          }}
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
            completed={game.status === "completed"}
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
          opponents={opponents}
          opponentDisconnected={opponentDisconnected}
          myPercent={myPercent}
          rematch={next.rematch}
          askedBy={next.askedBy}
          onShowResult={result.bringBack}
          credits={team?.credits}
        />
      }
      footer={
        result.visible && gameOver ? (
          <MultiplayerResult
            // A rematch closes the replay of the game it replaced.
            key={gameNumber}
            won={iWon}
            opponentName={opponentName}
            winnerName={gameOver.winnerName}
            time={iFinished ? formatTime(timerSecondsRef.current) : null}
            progressPercent={myPercent}
            difficulty={difficulty}
            score={result.score}
            next={next}
            opponentAway={opponentDisconnected}
            onKeepSolving={result.setAside}
            coop={team?.coop}
            credits={team?.credits}
            onLeave={onBack}
            replay={
              replay &&
              matchReplay(replay, {
                puzzle,
                solution,
                playerId,
                opponentName,
                gameOver,
              })
            }
          />
        ) : undefined
      }
    />
  );
}
