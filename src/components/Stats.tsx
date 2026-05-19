import { BarChart3, Flame, Trophy } from "lucide-react";
import { useMemo } from "react";
import {
  ASSIST_LEVEL_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_TEXT_COLORS,
} from "../lib/constants.ts";
import { getDailyStreak } from "../lib/daily-streak.ts";
import { formatShortDate, formatTime } from "../lib/format.ts";
import {
  getMultiplayerStats,
  getMultiplayerStatsForDifficulty,
  getMultiplayerSummary,
  type MultiplayerGameRecord,
} from "../lib/multiplayer-stats.ts";
import {
  type AssistLevelStats,
  getStats,
  getStatsByAssistLevel,
} from "../lib/stats.ts";
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
          <span className="icon-chip w-14 h-14">
            <BarChart3 size={26} aria-hidden="true" />
          </span>
          <div className="flex flex-col items-center gap-1">
            <h2 className="heading">Stats</h2>
            <p className="text-sm text-text-muted">
              {totalGames} {totalGames === 1 ? "game" : "games"} played
            </p>
          </div>
        </div>

        <div className="card w-full grid grid-cols-2 divide-x divide-border-default">
          <StreakStat
            icon={<Flame size={18} aria-hidden="true" />}
            value={streak.currentStreak}
            label="Current streak"
          />
          <StreakStat
            icon={<Trophy size={18} aria-hidden="true" />}
            value={streak.longestStreak}
            label="Longest streak"
          />
        </div>

        <section aria-label="Solo" className="flex flex-col gap-3 w-full">
          <h3 className="label">Solo</h3>
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
          <h3 className="label">Multiplayer</h3>
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
                  <h4 className="label">Recent matches</h4>
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

function StreakStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span className="flex items-center gap-1.5 text-accent">
        {icon}
        <span className="text-3xl font-bold text-text-primary font-mono tabular-nums">
          {value}
        </span>
      </span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

function DifficultyStats({ difficulty }: { difficulty: Difficulty }) {
  const byLevel = useMemo(
    () => getStatsByAssistLevel(difficulty),
    [difficulty],
  );
  const totalWins = byLevel.reduce((sum, s) => sum + s.gamesPlayed, 0);

  return (
    <div className="card p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-sm font-bold ${DIFFICULTY_TEXT_COLORS[difficulty]}`}
        >
          {DIFFICULTY_LABELS[difficulty]}
        </span>
        {totalWins > 0 && (
          <span className="text-xs font-medium text-text-muted">
            {totalWins} {totalWins === 1 ? "win" : "wins"}
          </span>
        )}
      </div>
      {byLevel.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border-default">
          {byLevel.map((modeStats) => (
            <AssistModeRow key={modeStats.assistLevel} stats={modeStats} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted text-center py-1">No games yet</p>
      )}
    </div>
  );
}

function AssistModeRow({ stats }: { stats: AssistLevelStats }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-text-primary">
          {ASSIST_LEVEL_LABELS[stats.assistLevel]}
        </span>
        <span className="text-[11px] text-text-muted">
          {stats.gamesPlayed} {stats.gamesPlayed === 1 ? "win" : "wins"}
        </span>
      </div>
      <div className="flex gap-6 text-center">
        <ModeStat label="Best" value={formatTime(stats.bestTime)} />
        <ModeStat label="Avg" value={formatTime(stats.averageTime)} />
      </div>
    </li>
  );
}

function ModeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-bold text-text-primary font-mono tabular-nums">
        {value}
      </div>
      <div className="text-[10px] text-text-muted uppercase tracking-wide">
        {label}
      </div>
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
    <div className="card w-full grid grid-cols-4 divide-x divide-border-default">
      <SummaryStat value={played} label="Played" />
      <SummaryStat value={wins} label="Wins" />
      <SummaryStat value={losses} label="Losses" />
      <SummaryStat value={`${Math.round(winRate * 100)}%`} label="Win rate" />
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
    <div className="flex flex-col items-center gap-0.5 py-3.5">
      <div className="text-xl font-bold text-text-primary font-mono tabular-nums">
        {value}
      </div>
      <div className="text-[10px] text-text-muted uppercase tracking-wide">
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
        <span
          className={`text-sm font-bold ${DIFFICULTY_TEXT_COLORS[difficulty]}`}
        >
          {DIFFICULTY_LABELS[difficulty]}
        </span>
        <span className="text-xs font-medium text-text-muted">
          {stats.wins}W · {stats.losses}L
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border-default rounded-xl bg-bg-inset">
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
  const outcomeColor = match.won
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-text-primary truncate">
          vs {match.opponentName || "Opponent"}
        </span>
        <span className="text-[11px] text-text-muted">
          {formatShortDate(match.date)} ·{" "}
          <span className={DIFFICULTY_TEXT_COLORS[match.difficulty]}>
            {DIFFICULTY_LABELS[match.difficulty]}
          </span>
        </span>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className={`text-sm font-bold ${outcomeColor}`}>
          {match.won ? "Won" : "Lost"}
        </span>
        <span className="text-[11px] text-text-muted font-mono tabular-nums">
          {formatTime(match.time)}
        </span>
      </div>
    </li>
  );
}
