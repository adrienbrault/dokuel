import { Flame, Trophy } from "lucide-react";
import { useMemo } from "react";
import {
  DIFFICULTIES,
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
} from "../lib/constants.ts";
import { getDailyStreak } from "../lib/daily-streak.ts";
import { formatShortDate, formatTime } from "../lib/format.ts";
import {
  getMultiplayerStats,
  getMultiplayerStatsForDifficulty,
  getMultiplayerSummary,
  type MultiplayerGameRecord,
} from "../lib/multiplayer-stats.ts";
import { getStats, getStatsForDifficulty } from "../lib/stats.ts";
import type { Difficulty } from "../lib/types.ts";

type StatsProps = {
  onBack: () => void;
};

const RECENT_MATCHES_LIMIT = 10;

export function Stats({ onBack }: StatsProps) {
  const allStats = useMemo(() => getStats(), []);
  const streak = useMemo(() => getDailyStreak(), []);
  const totalSoloWins = allStats.filter((s) => s.won).length;
  const mpSummary = useMemo(() => getMultiplayerSummary(), []);
  const mpRecent = useMemo(() => {
    const all = getMultiplayerStats();
    return [...all]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, RECENT_MATCHES_LIMIT);
  }, []);
  const totalGames = totalSoloWins + mpSummary.played;

  return (
    <div className="screen">
      <div className="screen-content gap-7">
        <div className="flex flex-col items-center gap-3">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent"
            aria-hidden="true"
          >
            <Trophy size={26} />
          </span>
          <div className="flex flex-col items-center gap-0.5">
            <h2 className="heading">Stats</h2>
            <p className="caption">
              {totalGames} {totalGames === 1 ? "game" : "games"} played
            </p>
          </div>
        </div>

        <div className="card p-5 w-full">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flame
              size={16}
              className="text-amber-500"
              fill="currentColor"
              aria-hidden="true"
            />
            <span className="label">Daily streak</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-3xl font-extrabold text-text-primary font-mono tabular-nums">
                {streak.currentStreak}
              </div>
              <div className="text-xs text-text-muted mt-0.5">Current</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-text-primary font-mono tabular-nums">
                {streak.longestStreak}
              </div>
              <div className="text-xs text-text-muted mt-0.5">Longest</div>
            </div>
          </div>
        </div>

        <section aria-label="Solo" className="flex flex-col gap-3 w-full">
          <h3 className="label px-1">Solo</h3>
          <div className="flex flex-col gap-3 w-full">
            {DIFFICULTIES.map((diff) => (
              <DifficultyStats key={diff} difficulty={diff} />
            ))}
          </div>
        </section>

        <section
          aria-label="Multiplayer"
          className="flex flex-col gap-3 w-full"
        >
          <h3 className="label px-1">Multiplayer</h3>
          {mpSummary.played === 0 ? (
            <div className="card p-5 w-full">
              <p className="text-sm text-text-muted text-center">
                No multiplayer games yet
              </p>
            </div>
          ) : (
            <>
              <MultiplayerSummaryCard
                played={mpSummary.played}
                wins={mpSummary.wins}
                losses={mpSummary.losses}
                winRate={mpSummary.winRate}
              />
              <div className="flex flex-col gap-3 w-full">
                {DIFFICULTIES.map((diff) => (
                  <MultiplayerDifficultyStats key={diff} difficulty={diff} />
                ))}
              </div>
              {mpRecent.length > 0 && (
                <div className="flex flex-col gap-2 w-full mt-1">
                  <h4 className="label px-1">Recent matches</h4>
                  <ul className="card divide-y divide-border-default w-full overflow-hidden">
                    {mpRecent.map((m) => (
                      <RecentMatchRow
                        key={`${m.roomId}-${m.gameNumber}`}
                        match={m}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

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

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${DIFFICULTY_BADGE_CLASSES[difficulty]}`}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

function DifficultyStats({ difficulty }: { difficulty: Difficulty }) {
  const stats = useMemo(() => getStatsForDifficulty(difficulty), [difficulty]);

  return (
    <div className="card p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <DifficultyBadge difficulty={difficulty} />
        {stats && (
          <span className="text-xs text-text-muted font-medium">
            {stats.gamesPlayed} {stats.gamesPlayed === 1 ? "win" : "wins"}
          </span>
        )}
      </div>
      {stats ? (
        <div className="grid grid-cols-2 gap-3 text-center">
          <StatTile value={formatTime(stats.bestTime)} label="Best" />
          <StatTile value={formatTime(stats.averageTime)} label="Average" />
        </div>
      ) : (
        <p className="text-sm text-text-muted text-center py-1">No games yet</p>
      )}
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-bg-raised py-2.5">
      <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}

function MultiplayerSummaryCard({
  played,
  wins,
  losses,
  winRate,
}: {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
}) {
  return (
    <div className="card p-4 w-full">
      <div className="grid grid-cols-4 gap-2 text-center">
        <SummaryStat value={played} label="Played" />
        <SummaryStat value={wins} label="Wins" />
        <SummaryStat value={losses} label="Losses" />
        <SummaryStat value={`${Math.round(winRate * 100)}%`} label="Win rate" />
      </div>
    </div>
  );
}

function SummaryStat({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div>
      <div className="text-xl font-extrabold text-text-primary font-mono tabular-nums">
        {value}
      </div>
      <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}

function MultiplayerDifficultyStats({
  difficulty,
}: {
  difficulty: Difficulty;
}) {
  const stats = useMemo(
    () => getMultiplayerStatsForDifficulty(difficulty),
    [difficulty],
  );
  if (!stats) return null;

  return (
    <div className="card p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <DifficultyBadge difficulty={difficulty} />
        <span className="text-xs text-text-muted font-medium">
          {stats.wins}W · {stats.losses}L
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <SummaryStat
          value={`${Math.round(stats.winRate * 100)}%`}
          label="Win rate"
        />
        <SummaryStat
          value={
            stats.bestWinTime !== null ? formatTime(stats.bestWinTime) : "—"
          }
          label="Best win"
        />
        <SummaryStat value={stats.played} label="Played" />
      </div>
    </div>
  );
}

function RecentMatchRow({ match }: { match: MultiplayerGameRecord }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={`w-1 self-stretch rounded-full ${match.won ? "bg-emerald-500" : "bg-rose-400"}`}
        aria-hidden="true"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-text-primary truncate">
          vs {match.opponentName || "Opponent"}
        </span>
        <span className="text-[11px] text-text-muted">
          {formatShortDate(match.date)} · {DIFFICULTY_LABELS[match.difficulty]}
        </span>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span
          className={`text-sm font-bold ${match.won ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
        >
          {match.won ? "Won" : "Lost"}
        </span>
        <span className="text-[11px] text-text-muted font-mono tabular-nums">
          {formatTime(match.time)}
        </span>
      </div>
    </li>
  );
}
