import { useMemo } from "react";
import { getDailyStreak } from "../lib/daily-streak.ts";
import { formatTime } from "../lib/format.ts";
import { getStats, getStatsForDifficulty } from "../lib/stats.ts";
import type { Difficulty } from "../lib/types.ts";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  hard: "text-orange-600 dark:text-orange-400",
  expert: "text-rose-600 dark:text-rose-400",
};

type StatsProps = {
  onBack: () => void;
};

export function Stats({ onBack }: StatsProps) {
  const allStats = useMemo(() => getStats(), []);
  const streak = useMemo(() => getDailyStreak(), []);
  const totalWins = allStats.filter((s) => s.won).length;

  return (
    <div className="screen">
      <div className="screen-content gap-8">
        <div className="flex flex-col items-center gap-1">
          <h2 className="heading">Stats</h2>
          <p className="text-sm text-text-muted">
            {totalWins} {totalWins === 1 ? "game" : "games"} completed
          </p>
        </div>

        <div className="card p-4 w-full">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-text-primary font-mono tabular-nums">
                {streak.currentStreak}
              </div>
              <div className="text-xs text-text-muted">Current Streak</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary font-mono tabular-nums">
                {streak.longestStreak}
              </div>
              <div className="text-xs text-text-muted">Longest Streak</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full">
          {DIFFICULTIES.map((diff) => (
            <DifficultyStats key={diff} difficulty={diff} />
          ))}
        </div>

        <button
          type="button"
          className="btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function DifficultyStats({ difficulty }: { difficulty: Difficulty }) {
  const stats = useMemo(() => getStatsForDifficulty(difficulty), [difficulty]);

  return (
    <div className="card p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-sm font-semibold ${DIFFICULTY_COLORS[difficulty]}`}
        >
          {DIFFICULTY_LABELS[difficulty]}
        </span>
        {stats && (
          <span className="text-xs text-text-muted">
            {stats.gamesPlayed} {stats.gamesPlayed === 1 ? "win" : "wins"}
          </span>
        )}
      </div>
      {stats ? (
        <div className="grid grid-cols-2 gap-4 text-center">
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
      ) : (
        <p className="text-sm text-text-muted text-center">No games yet</p>
      )}
    </div>
  );
}
