import { formatTime } from "../lib/format.ts";
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
  stats?: { gamesPlayed: number; bestTime: number; averageTime: number } | null;
  isNewPB?: boolean | undefined;
};

export function GameResult({
  isWinner,
  time,
  difficulty,
  isMultiplayer,
  onRematch,
  onNewGame,
  stats,
  isNewPB,
}: GameResultProps) {
  const handleShare = () => {
    const lines = ["Sudoku"];
    if (difficulty) lines[0] += ` ${DIFFICULTY_LABELS[difficulty]}`;
    lines.push(`Time: ${time}`);
    if (isNewPB) lines.push("New Personal Best!");
    lines.push("https://sudoku.brage.fr");
    navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <div className="modal-overlay p-6">
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
      <div className="modal-panel max-w-sm sm:max-w-md w-full relative">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl animate-emoji-bounce">
            {isWinner ? "🎉" : "👏"}
          </span>
          <h2 className="heading">
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
          <span className="text-3xl font-mono font-bold tabular-nums text-text-primary">
            {time}
          </span>
          {isNewPB && !isMultiplayer && (
            <span className="text-sm font-semibold text-accent">
              New Personal Best!
            </span>
          )}
        </div>

        {stats && !isMultiplayer && (
          <div className="grid grid-cols-3 gap-4 w-full text-center">
            <div>
              <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {stats.gamesPlayed}
              </div>
              <div className="text-xs text-text-muted">Played</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {formatTime(stats.bestTime)}
              </div>
              <div className="text-xs text-text-muted">Best</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {formatTime(stats.averageTime)}
              </div>
              <div className="text-xs text-text-muted">Average</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          {onRematch && (
            <button
              type="button"
              className="btn btn-primary w-full py-3 text-lg"
              onClick={onRematch}
            >
              {isMultiplayer ? "Rematch" : "Play Again"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary w-full py-3 text-lg"
            onClick={onNewGame}
          >
            New Game
          </button>
          {!isMultiplayer && (
            <button
              type="button"
              className="btn btn-ghost w-full py-2"
              onClick={handleShare}
            >
              Share Result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
