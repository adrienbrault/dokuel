import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChallengeRecorder } from "../hooks/useChallengeRecorder.ts";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useResumableSudoku } from "../hooks/useResumableSudoku.ts";
import { useSoloGameInput } from "../hooks/useSoloGameInput.ts";
import { completionPercent } from "../lib/board-engine.ts";
import { shareChallenge } from "../lib/challenge.ts";
import { formatTime } from "../lib/format.ts";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import { getPlayerName } from "../lib/player.ts";
import { getStatsForDifficulty } from "../lib/stats.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { Board } from "./Board.tsx";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { HintBanner } from "./HintBanner.tsx";
import { NumPad } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";

const EMPTY_CONFLICTS = new Set<number>();

type SoloGameProps = {
  difficulty: Difficulty;
  gameKey?: string | undefined;
  assistLevel?: AssistLevel | undefined;
  initialPuzzle?: string | undefined;
  title?: string | undefined;
  /** ISO date for daily challenges; drives streak via completeGame. */
  dailyDate?: string | undefined;
  onBack: () => void;
  onRematch?: (() => void) | undefined;
  onComplete?:
    | ((time: number, result: GameCompletionResult) => void)
    | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
};

export function SoloGame({
  difficulty,
  gameKey,
  assistLevel: initialAssistLevel = "standard",
  initialPuzzle,
  title,
  dailyDate,
  onBack,
  onRematch,
  onComplete,
  streakInfo,
}: SoloGameProps) {
  const timerSecondsRef = useRef(0);
  const getTimerSeconds = useCallback(() => timerSecondsRef.current, []);

  const { game, puzzle, assistLevel, setAssistLevel, initialTimerSeconds } =
    useResumableSudoku({
      gameKey,
      initialPuzzle,
      difficulty,
      initialAssistLevel,
      getTimerSeconds,
      dailyDate,
      onComplete,
    });

  // Seed the ref so saves before the first onTick capture the resumed timer.
  if (timerSecondsRef.current === 0 && initialTimerSeconds > 0) {
    timerSecondsRef.current = initialTimerSeconds;
  }

  const { position, setPosition } = useNumPadPosition();
  const revealed = useDelayedFlag(true, 600);
  const showResult = useDelayedFlag(game.status === "completed", 300);
  const [paused, setPaused] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem("sudoku_numpad_tip_dismissed") === "1",
  );

  // Capture PB for this difficulty + assist mode, before this result saves.
  const priorStats = useMemo(
    () => getStatsForDifficulty(difficulty, assistLevel),
    [difficulty, assistLevel],
  );
  const personalBest = priorStats?.bestTime ?? null;

  // Record the solve as a ghost timeline so it can be shared as a
  // challenge — a friend then races this pace on the same board.
  const myPercent = useMemo(
    () => completionPercent(puzzle, game.cellsRemaining),
    [puzzle, game.cellsRemaining],
  );
  const { samples: ghostSamples } = useChallengeRecorder({
    completionPercent: myPercent,
    getTimerSeconds,
    storageKey: gameKey,
  });

  const handleChallengeFriend = useCallback(async () => {
    await shareChallenge({
      v: 1,
      puzzle,
      difficulty,
      assistLevel,
      challengerName: getPlayerName(),
      finalTime: timerSecondsRef.current,
      hintsUsed: game.hintsUsed,
      ghost: ghostSamples,
    });
  }, [puzzle, difficulty, assistLevel, game.hintsUsed, ghostSamples]);

  const input = useSoloGameInput(game, assistLevel, paused);

  const handleBack = () => {
    if (
      game.status === "playing" &&
      game.historyLength > 0 &&
      !window.confirm("Leave game? Your progress is saved.")
    ) {
      return;
    }
    onBack();
  };

  // Auto-pause when tab loses visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && game.status === "playing") {
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [game.status]);

  return (
    <GameLayout
      onBack={handleBack}
      title={title}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={input.highlight.deselectCell}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      settingsExtra={
        <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
      }
      timer={
        <button
          type="button"
          className="flex flex-col items-center px-4 py-1.5 rounded-2xl bg-surface border border-border-default shadow-sm press-spring-soft touch-manipulation"
          onClick={() => game.status === "playing" && setPaused((p) => !p)}
          aria-label={paused ? "Resume" : "Pause"}
        >
          <Timer
            running={game.status === "playing" && !paused && revealed}
            initialSeconds={initialTimerSeconds}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
            className="font-mono text-lg font-bold tabular-nums text-text-primary leading-none"
          />
          <span className="text-[0.6875rem] text-text-muted font-mono tabular-nums mt-0.5">
            {paused ? (
              "Paused"
            ) : (
              <>
                <span className="text-accent font-medium">
                  {81 - game.cellsRemaining}
                </span>
                /81
                {personalBest !== null && ` · PB ${formatTime(personalBest)}`}
              </>
            )}
          </span>
        </button>
      }
      numPad={
        <NumPad
          ref={input.numPadRef}
          position={position}
          remainingCounts={game.remainingCounts}
          selectedValue={
            game.selectedCell
              ? game.board[game.selectedCell.row]![game.selectedCell.col]!.value
              : input.highlight.highlightedDigit
          }
          showRemainingCounts={assistLevel === "full"}
          disableCompleted={assistLevel !== "paper"}
          onTapNumber={input.onTapNumber}
          onHoldNumber={input.onHoldNumber}
          onPressEnd={input.onPressEnd}
          onStartDrag={input.startNumpadDrag}
          onSkimDigit={input.highlight.skimToDigit}
        />
      }
      board={
        <div className="relative w-full">
          <Board
            board={game.board}
            selectedCell={paused ? null : game.selectedCell}
            selectedCells={paused ? undefined : game.selectedCells}
            assistLevel={assistLevel}
            conflicts={assistLevel !== "paper" ? game.errors : EMPTY_CONFLICTS}
            hintCells={input.hintCells}
            highlightedDigit={paused ? null : input.highlight.highlightedDigit}
            onSelectCell={paused ? () => {} : input.highlight.selectCell}
            onSetSelectedCells={
              paused ? undefined : input.highlight.setSelectedCells
            }
            animateReveal={!revealed}
            chargingDigit={paused ? null : input.chargingDigit}
            dragState={paused ? null : input.dragState}
            onStartCellDrag={paused ? undefined : input.startCellDrag}
          />
          <DigitDragIndicator state={paused ? null : input.dragState} />
          {paused && (
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 backdrop-blur-md rounded-lg"
              onClick={() => setPaused(false)}
              aria-label="Resume game"
            >
              <span className="text-xl font-semibold text-text-muted">
                Paused — tap to resume
              </span>
            </button>
          )}
        </div>
      }
      controls={
        <>
          {game.activeHint && (
            <HintBanner hint={game.activeHint} onDismiss={game.dismissHint} />
          )}
          <GameControls
            onErase={game.erase}
            onUndo={game.undo}
            historyLength={game.historyLength}
            onHint={game.hint}
          />
        </>
      }
      footer={
        showResult ? (
          <GameResult
            isWinner={true}
            time={formatTime(timerSecondsRef.current)}
            timeSeconds={timerSecondsRef.current}
            difficulty={difficulty}
            onNewGame={onBack}
            onRematch={onRematch}
            stats={
              priorStats ?? {
                gamesPlayed: 0,
                bestTime: timerSecondsRef.current,
                averageTime: timerSecondsRef.current,
              }
            }
            isNewPB={
              game.hintsUsed === 0 &&
              (personalBest === null || timerSecondsRef.current < personalBest)
            }
            hintsUsed={game.hintsUsed}
            streakInfo={streakInfo}
            onChallengeFriend={handleChallengeFriend}
            isDaily={!!streakInfo || !!title?.startsWith("Daily")}
            tip={
              !tipDismissed && position === "bottom"
                ? "Tip: Move the numpad to the side for faster two-finger play! Open settings (gear icon) to try it."
                : undefined
            }
            onDismissTip={() => {
              setTipDismissed(true);
              localStorage.setItem("sudoku_numpad_tip_dismissed", "1");
            }}
          />
        ) : undefined
      }
    />
  );
}
