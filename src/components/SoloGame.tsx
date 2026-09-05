import { useEffect, useMemo, useRef, useState } from "react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useNumpadInteractions } from "../hooks/useNumpadInteractions.ts";
import { useResumableSudoku } from "../hooks/useResumableSudoku.ts";
import { buildChallengeUrl, type SoloChallenge } from "../lib/challenge.ts";
import { formatTime } from "../lib/format.ts";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import { getPlayerName } from "../lib/player-identity.ts";
import { getStatsForDifficulty } from "../lib/stats.ts";
import { cellKey } from "../lib/sudoku.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { Board } from "./Board.tsx";
import { ChallengeBanner } from "./ChallengeBanner.tsx";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { HintBanner } from "./HintBanner.tsx";
import { NumPad } from "./NumPad.tsx";
import { TimerPill } from "./TimerPill.tsx";

const EMPTY_CONFLICTS = new Set<number>();

type SoloGameProps = {
  difficulty: Difficulty;
  gameKey?: string | undefined;
  assistLevel?: AssistLevel | undefined;
  initialPuzzle?: string | undefined;
  title?: string | undefined;
  /** ISO date for daily challenges; drives streak via completeGame. */
  dailyDate?: string | undefined;
  /** Marks the daily challenge for share text — not sniffed from the title. */
  isDaily?: boolean | undefined;
  /** ISO date when this daily comes from the archive rather than today. */
  archiveDate?: string | undefined;
  /** A friend's time to beat, carried by the link that opened this board. */
  challenge?: SoloChallenge | undefined;
  /** An extra link for the result dialog (the daily offers its archive). */
  resultLink?: { label: string; onClick: () => void } | undefined;
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
  isDaily = false,
  archiveDate,
  challenge,
  resultLink,
  onBack,
  onRematch,
  onComplete,
  streakInfo,
}: SoloGameProps) {
  const timerSecondsRef = useRef(0);

  const { game, assistLevel, setAssistLevel, initialTimerSeconds } =
    useResumableSudoku({
      gameKey,
      initialPuzzle,
      difficulty,
      initialAssistLevel,
      getTimerSeconds: () => timerSecondsRef.current,
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

  const {
    highlight,
    chargingDigit,
    keyDigit,
    numPadRef,
    numPadProps,
    dragState,
    startCellDrag,
  } = useNumpadInteractions({
    game,
    disabled: paused || game.status !== "playing",
    assistLevel,
  });

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

  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onDeselectCell: game.deselectCell,
    onPlaceNumber: keyDigit,
    onErase: game.erase,
    onUndo: game.undo,
    onRedo: game.redo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing" && !paused,
  });

  const hintCells = useMemo(() => {
    if (!game.activeHint) return undefined;
    const set = new Set<number>();
    for (const pos of game.activeHint.relatedCells) {
      set.add(cellKey(pos.row, pos.col));
    }
    return set;
  }, [game.activeHint]);

  // An elimination hint points at two sets of cells: the ones proving
  // it, above, and the ones the player is asked to clear.
  const eliminatedCells = useMemo(() => {
    const hint = game.activeHint;
    if (hint?.kind !== "elimination") return undefined;
    const set = new Set<number>();
    for (const pos of hint.eliminatedCells) {
      set.add(cellKey(pos.row, pos.col));
    }
    return set;
  }, [game.activeHint]);

  return (
    <GameLayout
      onBack={handleBack}
      title={title}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={highlight.deselectCell}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      settingsExtra={
        <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
      }
      timer={
        <TimerPill
          running={game.status === "playing" && !paused && revealed}
          initialSeconds={initialTimerSeconds}
          onTick={(s) => {
            timerSecondsRef.current = s;
          }}
          onClick={() => game.status === "playing" && setPaused((p) => !p)}
          ariaLabel={paused ? "Resume" : "Pause"}
          subline={
            paused ? (
              "Paused"
            ) : (
              <>
                <span className="text-accent font-medium">
                  {81 - game.cellsRemaining}
                </span>
                /81
                {personalBest !== null && ` · PB ${formatTime(personalBest)}`}
              </>
            )
          }
        />
      }
      numPad={<NumPad ref={numPadRef} position={position} {...numPadProps} />}
      board={
        <div className="relative w-full">
          <Board
            board={game.board}
            selectedCell={paused ? null : game.selectedCell}
            selectedCells={paused ? undefined : game.selectedCells}
            assistLevel={assistLevel}
            conflicts={assistLevel !== "paper" ? game.errors : EMPTY_CONFLICTS}
            hintCells={hintCells}
            eliminatedCells={eliminatedCells}
            highlightedDigit={paused ? null : highlight.highlightedDigit}
            onSelectCell={paused ? () => {} : highlight.selectCell}
            onSetSelectedCells={paused ? undefined : highlight.setSelectedCells}
            animateReveal={!revealed}
            chargingDigit={paused ? null : chargingDigit}
            dragState={paused ? null : dragState}
            onStartCellDrag={paused ? undefined : startCellDrag}
          />
          <DigitDragIndicator state={paused ? null : dragState} />
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
          {challenge && game.status !== "completed" && (
            <ChallengeBanner challenge={challenge} />
          )}
          {game.activeHint && (
            <HintBanner hint={game.activeHint} onDismiss={game.dismissHint} />
          )}
          <GameControls
            onErase={game.erase}
            onUndo={game.undo}
            onRedo={game.redo}
            onFillNotes={assistLevel === "paper" ? undefined : game.fillNotes}
            historyLength={game.historyLength}
            redoLength={game.redoLength}
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
            isDaily={isDaily}
            archiveDate={archiveDate}
            challenge={challenge}
            footerLink={resultLink}
            challengeUrl={
              // Daily boards are the same for everyone, so a seeded
              // link would only re-send today's puzzle; the challenge
              // loop is for solo boards a friend cannot already play.
              !isDaily && gameKey
                ? buildChallengeUrl({
                    difficulty,
                    gameKey,
                    timeSeconds: timerSecondsRef.current,
                    by: getPlayerName(),
                  })
                : undefined
            }
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
