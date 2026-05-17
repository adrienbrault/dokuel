import { useEffect, useMemo, useRef, useState } from "react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useDigitHighlight } from "../hooks/useDigitHighlight.ts";
import { useGameDigitDrag } from "../hooks/useGameDigitDrag.ts";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadLayout } from "../hooks/useNumPadLayout.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useResumableSudoku } from "../hooks/useResumableSudoku.ts";
import { formatTime } from "../lib/format.ts";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import { getStatsForDifficulty } from "../lib/stats.ts";
import { cellKey } from "../lib/sudoku.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { Board } from "./Board.tsx";
import { DigitDragGhost } from "./DigitDragGhost.tsx";
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

  // Seed the ref so saves happening before the first onTick still capture the
  // resumed timer value rather than zero.
  if (timerSecondsRef.current === 0 && initialTimerSeconds > 0) {
    timerSecondsRef.current = initialTimerSeconds;
  }

  const { position, setPosition } = useNumPadPosition();
  const { layout, setLayout } = useNumPadLayout();
  const revealed = useDelayedFlag(true, 600);
  const showResult = useDelayedFlag(game.status === "completed", 300);
  const [paused, setPaused] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem("sudoku_numpad_tip_dismissed") === "1",
  );

  // Capture PB before this game's result is saved
  const priorStats = useMemo(
    () => getStatsForDifficulty(difficulty),
    [difficulty],
  );
  const personalBest = priorStats?.bestTime ?? null;

  // Keyboard digit follows the current notesMode flag (N toggles it),
  // preserving the established "press N then 1" pencil-mark workflow.
  const handleKeyboardNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      const wasNoteMode = game.notesMode;
      game.placeNumber(n, assistLevel !== "paper");
      if (wasNoteMode) game.deselectCell();
    }
  };

  // Touch numpad: tap is the cheap, frequent action (note); hold is the
  // deliberate commit (value). The 400ms hold doubles as a guard against
  // accidental value placement.
  const [chargingDigit, setChargingDigit] = useState<number | null>(null);
  // With no cell selected, the numpad doubles as a filter chip.
  const highlight = useDigitHighlight(game);
  // Tracks whether the long-press digit fired during the current gesture.
  // We defer the note-deselect to press end so a tap+hold can still land
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

  // Digit drag: drop commits the value (the deliberate gesture earns
  // the commit). Notes still come from tap-on-numpad.
  const { dragState, startNumpadDrag, startCellDrag } = useGameDigitDrag({
    game,
    disabled: paused || game.status !== "playing",
    autoEliminateNotes: assistLevel !== "paper",
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
    onPlaceNumber: handleKeyboardNumber,
    onErase: game.erase,
    onUndo: game.undo,
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

  return (
    <GameLayout
      onBack={handleBack}
      title={title}
      position={position}
      onPositionChange={setPosition}
      layout={layout}
      onLayoutChange={setLayout}
      onDeselectCell={game.deselectCell}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      settingsExtra={
        <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
      }
      timer={
        <button
          type="button"
          className="flex flex-col items-center touch-manipulation"
          onClick={() => {
            if (game.status === "playing") setPaused((p) => !p);
          }}
          aria-label={paused ? "Resume" : "Pause"}
        >
          <Timer
            running={game.status === "playing" && !paused && revealed}
            initialSeconds={initialTimerSeconds}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
          />
          <span className="text-xs text-text-muted font-mono tabular-nums">
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
          position={position}
          layout={layout}
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
        />
      }
      board={
        <div className="relative aspect-square h-full max-h-full max-w-full mx-auto">
          <Board
            board={game.board}
            selectedCell={paused ? null : game.selectedCell}
            selectedCells={paused ? undefined : game.selectedCells}
            assistLevel={assistLevel}
            conflicts={assistLevel !== "paper" ? game.errors : EMPTY_CONFLICTS}
            hintCells={hintCells}
            highlightedDigit={paused ? null : highlight.highlightedDigit}
            onSelectCell={paused ? () => {} : highlight.selectCell}
            onSetSelectedCells={paused ? undefined : highlight.setSelectedCells}
            animateReveal={!revealed}
            chargingDigit={paused ? null : chargingDigit}
            dragState={paused ? null : dragState}
            onStartCellDrag={paused ? undefined : startCellDrag}
          />
          <DigitDragGhost state={dragState} />
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
