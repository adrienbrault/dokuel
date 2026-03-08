import { formatTime } from "../lib/format.ts";
import { getStatsForDifficulty } from "../lib/stats.ts";
import type { Difficulty } from "../lib/types.ts";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  hard: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  expert: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

type GameResultProps = {
  isWinner: boolean;
  time: string;
  timeSeconds?: number | undefined;
  difficulty?: Difficulty | undefined;
  isMultiplayer?: boolean | undefined;
  onRematch?: (() => void) | undefined;
  onNewGame: () => void;
};

export function GameResult({
  isWinner,
  time,
  timeSeconds,
  difficulty,
  isMultiplayer,
  onRematch,
  onNewGame,
}: GameResultProps) {
  const stats =
    difficulty && timeSeconds != null
      ? getStatsForDifficulty(difficulty)
      : null;
  const isNewBest =
    stats != null && timeSeconds != null && timeSeconds < stats.bestTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-modal-backdrop">
      {isWinner && (
        <div className="confetti-container">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      <div className="flex flex-col items-center gap-5 bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl max-w-sm sm:max-w-md w-full animate-modal-content relative">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl animate-emoji-bounce">
            {isWinner ? "🎉" : "👏"}
          </span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isWinner ? "You Won!" : "Puzzle Complete!"}
          </h2>
          {difficulty && (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[difficulty]}`}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-mono font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {time}
          </span>
          {isNewBest && (
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              New Best!
            </span>
          )}
          {stats && !isNewBest && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Best: {formatTime(stats.bestTime)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 w-full">
          {onRematch && (
            <button
              type="button"
              className="w-full py-3 rounded-xl text-lg font-semibold bg-accent text-white press-spring-soft select-none touch-manipulation"
              onClick={onRematch}
            >
              {isMultiplayer ? "Rematch" : "Play Again"}
            </button>
          )}
          <button
            type="button"
            className="w-full py-3 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 press-spring-soft select-none touch-manipulation"
            onClick={onNewGame}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
