import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadLayout } from "../hooks/useNumPadLayout.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSoloGameEffects } from "../hooks/useSoloGameEffects.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { EMPTY_CONFLICTS } from "../lib/constants.ts";
import { loadGame } from "../lib/game-storage.ts";
import { getStatsForDifficulty } from "../lib/stats.ts";
import { cellKey, generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { HintBanner } from "./HintBanner.tsx";
import { NumPad } from "./NumPad.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { AssistLevelIcon, NumPadPositionIcon } from "./SettingIcons.tsx";
import { SoloGameResult } from "./SoloGameResult.tsx";
import { TimerButton } from "./TimerButton.tsx";

type SoloGameProps = {
  difficulty: Difficulty;
  gameKey?: string | undefined;
  assistLevel?: AssistLevel | undefined;
  initialPuzzle?: string | undefined;
  title?: string | undefined;
  onBack: () => void;
  onRematch?: (() => void) | undefined;
  onComplete?: ((time: number) => void) | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
};

export function SoloGame({
  difficulty,
  gameKey,
  assistLevel: initialAssistLevel = "standard",
  initialPuzzle,
  title,
  onBack,
  onRematch,
  onComplete,
  streakInfo,
}: SoloGameProps) {
  const saved = useMemo(() => (gameKey ? loadGame(gameKey) : null), [gameKey]);

  const puzzle = useMemo(() => {
    if (saved?.puzzle) return saved.puzzle;
    if (initialPuzzle) return initialPuzzle;
    return generatePuzzle(difficulty);
  }, [difficulty, initialPuzzle, saved]);

  const solution = useMemo(() => solvePuzzle(puzzle), [puzzle]);

  const savedBoard = useMemo(
    () => (saved ? { values: saved.values, notes: saved.notes } : undefined),
    [saved],
  );

  const game = useSudoku(puzzle, solution, savedBoard);
  const { position, setPosition } = useNumPadPosition();
  const numPadLayout = useNumPadLayout(position);
  const timerSecondsRef = useRef(saved?.timer ?? 0);
  const [showResult, setShowResult] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [assistLevel, setAssistLevel] = useState<AssistLevel>(
    saved?.assistLevel ?? initialAssistLevel,
  );
  const [paused, setPaused] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem("sudoku_numpad_tip_dismissed") === "1",
  );
  const [notesTooltipDismissed, setNotesTooltipDismissed] = useState(
    () => localStorage.getItem("sudoku_notes_tip_dismissed") === "1",
  );
  const showNotesTooltip =
    !notesTooltipDismissed &&
    (difficulty === "hard" || difficulty === "expert") &&
    game.selectedCell !== null &&
    game.status === "playing";

  const priorStats = useMemo(
    () => getStatsForDifficulty(difficulty),
    [difficulty],
  );
  const personalBest = priorStats?.bestTime ?? null;
  const givenCount = useMemo(
    () => puzzle.split("").filter((c) => c !== ".").length,
    [puzzle],
  );
  const progressPercent = useMemo(() => {
    const userFillable = 81 - givenCount;
    if (userFillable === 0) return 100;
    const userFilled = 81 - game.cellsRemaining - givenCount;
    return Math.round((userFilled / userFillable) * 100);
  }, [givenCount, game.cellsRemaining]);

  useSoloGameEffects({
    board: game.board,
    status: game.status,
    gameKey,
    puzzle,
    difficulty,
    assistLevel,
    timerRef: timerSecondsRef,
    hintsUsed: game.hintsUsed,
    onComplete,
    setRevealed,
    setShowResult,
  });

  const handleNumber = (n: number) => {
    if (game.selectedCell || game.selectedCells.size > 0) {
      game.placeNumber(n, assistLevel !== "paper");
    }
  };

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
    onPlaceNumber: handleNumber,
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing" && !paused,
  });

  const hintCells = useMemo(() => {
    if (!game.activeHint) return undefined;
    const set = new Set<number>();
    for (const pos of game.activeHint.relatedCells)
      set.add(cellKey(pos.row, pos.col));
    return set;
  }, [game.activeHint]);

  const dismissNotesTooltip = () => {
    setNotesTooltipDismissed(true);
    localStorage.setItem("sudoku_notes_tip_dismissed", "1");
  };
  const dismissTip = () => {
    setTipDismissed(true);
    localStorage.setItem("sudoku_numpad_tip_dismissed", "1");
  };

  return (
    <GameLayout
      onBack={handleBack}
      title={title}
      position={position}
      onDeselectCell={game.deselectCell}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      settings={[
        {
          key: "position",
          label: "Numpad position",
          icon: <NumPadPositionIcon position={position} />,
          content: (
            <NumPadPositionToggle position={position} onChange={setPosition} />
          ),
        },
        {
          key: "assist",
          label: "Assist level",
          icon: <AssistLevelIcon level={assistLevel} />,
          content: (
            <AssistLevelPicker value={assistLevel} onChange={setAssistLevel} />
          ),
        },
      ]}
      timer={
        <TimerButton
          status={game.status}
          paused={paused}
          setPaused={setPaused}
          revealed={revealed}
          initialSeconds={saved?.timer}
          onTick={(s) => {
            timerSecondsRef.current = s;
          }}
          progressPercent={progressPercent}
          personalBest={personalBest}
        />
      }
      numPad={
        <NumPad
          position={position}
          layout={numPadLayout}
          remainingCounts={game.remainingCounts}
          selectedValue={
            game.selectedCell
              ? game.board[game.selectedCell.row]![game.selectedCell.col]!.value
              : null
          }
          showRemainingCounts={assistLevel === "full"}
          disableCompleted={assistLevel !== "paper"}
          onNumber={handleNumber}
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
            hintCells={hintCells}
            onSelectCell={paused ? () => {} : game.selectCell}
            onSetSelectedCells={paused ? undefined : game.setSelectedCells}
            animateReveal={!revealed}
          />
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
            notesMode={game.notesMode}
            onToggleNotes={game.toggleNotesMode}
            onErase={game.erase}
            onUndo={game.undo}
            historyLength={game.historyLength}
            onHint={game.hint}
            showNotesTooltip={showNotesTooltip}
            onDismissNotesTooltip={dismissNotesTooltip}
          />
        </>
      }
      footer={
        showResult ? (
          <SoloGameResult
            timeSeconds={timerSecondsRef.current}
            difficulty={difficulty}
            onBack={onBack}
            onRematch={onRematch}
            priorStats={priorStats}
            personalBest={personalBest}
            hintsUsed={game.hintsUsed}
            streakInfo={streakInfo}
            isDaily={!!streakInfo || !!title?.startsWith("Daily")}
            position={position}
            tipDismissed={tipDismissed}
            onDismissTip={dismissTip}
          />
        ) : undefined
      }
    />
  );
}
