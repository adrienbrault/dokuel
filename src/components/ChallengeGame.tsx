import { useCallback, useMemo, useRef, useState } from "react";
import { useChallengeRecorder } from "../hooks/useChallengeRecorder.ts";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useDigitHighlight } from "../hooks/useDigitHighlight.ts";
import { useGameDigitDrag } from "../hooks/useGameDigitDrag.ts";
import { useGhostPlayback } from "../hooks/useGhostPlayback.ts";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useResumableSudoku } from "../hooks/useResumableSudoku.ts";
import { completionPercent } from "../lib/board-engine.ts";
import { shareChallenge } from "../lib/challenge.ts";
import { formatTime } from "../lib/format.ts";
import { getPlayerName } from "../lib/player.ts";
import type { Challenge } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { MultiplayerHeaderExtra } from "./MultiplayerHeaderExtra.tsx";
import { NumPad, type NumPadHandle } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";

const EMPTY_CONFLICTS = new Set<number>();

type ChallengeGameProps = {
  challenge: Challenge;
  onBack: () => void;
};

/**
 * The friend's side of an async challenge: the same board the challenger
 * solved, raced against a "ghost" progress bar that replays the
 * challenger's pace. Structurally a solo game with a ghost opponent — it
 * deliberately mirrors SoloGame rather than reusing the Yjs-bound
 * MultiplayerBoard. It also records its own run so the friend can
 * challenge someone back.
 */
export function ChallengeGame({ challenge, onBack }: ChallengeGameProps) {
  const timerSecondsRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const getTimerSeconds = useCallback(() => timerSecondsRef.current, []);

  const gameKey = useMemo(
    () => `challenge_${challenge.puzzle.slice(0, 24)}`,
    [challenge.puzzle],
  );

  const { game, assistLevel, initialTimerSeconds } = useResumableSudoku({
    gameKey,
    initialPuzzle: challenge.puzzle,
    difficulty: challenge.difficulty,
    initialAssistLevel: challenge.assistLevel,
    getTimerSeconds,
  });

  // Seed the timer from a resumed save so the ghost and autosave start
  // from the right offset rather than snapping forward after one tick.
  if (timerSecondsRef.current === 0 && initialTimerSeconds > 0) {
    timerSecondsRef.current = initialTimerSeconds;
  }
  if (elapsedSeconds === 0 && initialTimerSeconds > 0) {
    setElapsedSeconds(initialTimerSeconds);
  }

  const myPercent = useMemo(
    () => completionPercent(challenge.puzzle, game.cellsRemaining),
    [challenge.puzzle, game.cellsRemaining],
  );

  const { samples } = useChallengeRecorder({
    completionPercent: myPercent,
    getTimerSeconds,
    storageKey: gameKey,
  });

  const { ghostPercent, ghostFinished } = useGhostPlayback({
    samples: challenge.ghost,
    elapsedSeconds,
  });

  const { position, setPosition } = useNumPadPosition();
  const revealed = useDelayedFlag(true, 600);
  const iFinished = game.status === "completed";
  const showResult = useDelayedFlag(iFinished, 300);

  // Keyboard digit follows the current notesMode flag (N toggles it).
  const handleKeyboardNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      const wasNoteMode = game.notesMode;
      game.placeNumber(n, assistLevel !== "paper");
      if (wasNoteMode) game.deselectCell();
    }
  };

  // Touch numpad: a quick tap commits the value, a hold adds a pencil
  // note. With no cell selected, a tap toggles the digit's highlight.
  const [chargingDigit, setChargingDigit] = useState<number | null>(null);
  const highlight = useDigitHighlight(game);
  const handleTapValue = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", false);
    } else {
      highlight.toggle(n);
    }
  };
  const handleHoldNote = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper", true);
      setChargingDigit(n);
    }
  };
  const handlePressEnd = () => {
    setChargingDigit(null);
  };

  const numPadRef = useRef<NumPadHandle>(null);
  const { dragState, startNumpadDrag, startCellDrag } = useGameDigitDrag({
    game,
    disabled: game.status !== "playing",
    autoEliminateNotes: assistLevel !== "paper",
    onHighlightDigit: highlight.setDigit,
    onReturnToNumpad: (info) => numPadRef.current?.resumeSkimFromDrag(info),
  });

  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onDeselectCell: game.deselectCell,
    onPlaceNumber: handleKeyboardNumber,
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing",
  });

  const handleBack = () => {
    if (
      game.status === "playing" &&
      game.historyLength > 0 &&
      !window.confirm("Leave challenge? Your progress is saved.")
    ) {
      return;
    }
    onBack();
  };

  // The friend's own run becomes a fresh challenge — the relay case.
  const handleChallengeBack = useCallback(async () => {
    await shareChallenge({
      v: 1,
      puzzle: challenge.puzzle,
      difficulty: challenge.difficulty,
      assistLevel: challenge.assistLevel,
      challengerName: getPlayerName(),
      finalTime: timerSecondsRef.current,
      hintsUsed: 0,
      ghost: samples,
    });
  }, [challenge, samples]);

  const friendTime = timerSecondsRef.current;
  const delta = friendTime - challenge.finalTime;
  const comparison = (
    <span className="flex flex-col gap-0.5">
      <span>
        You {formatTime(friendTime)} · {challenge.challengerName}{" "}
        {formatTime(challenge.finalTime)}
      </span>
      <span className="font-semibold text-text-primary">
        {delta === 0
          ? "Dead heat — a perfect tie!"
          : delta < 0
            ? `You won by ${formatTime(-delta)}`
            : `${challenge.challengerName} won by ${formatTime(delta)}`}
      </span>
      {challenge.hintsUsed > 0 && (
        <span className="text-xs text-text-muted">
          {challenge.challengerName} used {challenge.hintsUsed} hint
          {challenge.hintsUsed > 1 ? "s" : ""}
        </span>
      )}
    </span>
  );

  return (
    <GameLayout
      onBack={handleBack}
      title={`Challenge from ${challenge.challengerName}`}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={highlight.deselectCell}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      timer={
        <div className="flex flex-col items-center px-4 py-1.5 rounded-2xl bg-surface border border-border-default shadow-sm">
          <Timer
            running={game.status === "playing" && revealed}
            initialSeconds={initialTimerSeconds}
            onTick={(s) => {
              timerSecondsRef.current = s;
              setElapsedSeconds(s);
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
          ref={numPadRef}
          position={position}
          remainingCounts={game.remainingCounts}
          selectedValue={
            game.selectedCell
              ? game.board[game.selectedCell.row]![game.selectedCell.col]!.value
              : highlight.highlightedDigit
          }
          showRemainingCounts={assistLevel === "full"}
          disableCompleted={assistLevel !== "paper"}
          onTapNumber={handleTapValue}
          onHoldNumber={handleHoldNote}
          onPressEnd={handlePressEnd}
          onStartDrag={startNumpadDrag}
          onSkimDigit={highlight.skimToDigit}
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
      headerExtra={
        <MultiplayerHeaderExtra
          gameOver={
            ghostFinished && !iFinished
              ? { winnerId: "challenger", winnerName: challenge.challengerName }
              : null
          }
          iFinished={iFinished}
          showOpponentProgress
          opponentProgress={{ completionPercent: ghostPercent }}
          opponentDisconnected={false}
          myPercent={myPercent}
          opponentLabel={challenge.challengerName}
        />
      }
      footer={
        showResult ? (
          <GameResult
            isWinner={delta <= 0}
            time={formatTime(friendTime)}
            difficulty={challenge.difficulty}
            isMultiplayer
            comparison={comparison}
            onChallengeFriend={handleChallengeBack}
            onNewGame={onBack}
          />
        ) : undefined
      }
    />
  );
}
