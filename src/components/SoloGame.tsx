import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadLayout } from "../hooks/useNumPadLayout.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { EMPTY_CONFLICTS } from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import {
  boardToNotes,
  boardToValues,
  deleteGame,
  loadGame,
  type SavedGame,
  saveGame,
} from "../lib/game-storage.ts";
import { getStatsForDifficulty, saveGameResult } from "../lib/stats.ts";
import { cellKey, generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { HintBanner } from "./HintBanner.tsx";
import { NumPad } from "./NumPad.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { AssistLevelIcon, NumPadPositionIcon } from "./SettingIcons.tsx";
import { Timer } from "./Timer.tsx";

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

  // Capture PB before this game's result is saved
  const priorStats = useMemo(
    () => getStatsForDifficulty(difficulty),
    [difficulty],
  );
  const personalBest = priorStats?.bestTime ?? null;

  // Auto-save on every board change
  useEffect(() => {
    if (!gameKey || game.status === "completed") return;
    const data: SavedGame = {
      puzzle,
      values: boardToValues(game.board),
      notes: boardToNotes(game.board),
      timer: timerSecondsRef.current,
      difficulty,
      assistLevel,
    };
    saveGame(gameKey, data);
  }, [game.board, gameKey, puzzle, difficulty, assistLevel, game.status]);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (game.status !== "completed") return;
    if (gameKey) deleteGame(gameKey);
    saveGameResult(difficulty, timerSecondsRef.current, true, game.hintsUsed);
    onComplete?.(timerSecondsRef.current);
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [game.status, difficulty, gameKey, onComplete, game.hintsUsed]);

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
            initialSeconds={saved?.timer}
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
                ? "Tip: Move the numpad to the side for faster two-finger play! Tap the pad icon to try it."
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
