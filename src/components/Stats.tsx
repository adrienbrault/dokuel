import { useMemo, useState } from "react";
import {
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
import { getLifetimeGamesPlayed } from "../lib/stats.ts";
import type { Difficulty } from "../lib/types.ts";
import { BackupControls } from "./BackupControls.tsx";
import { RivalryHistory } from "./RivalryHistory.tsx";
import { SoloStats } from "./SoloStats.tsx";

type StatsProps = {
  onBack: () => void;
};

const RECENT_MATCHES_LIMIT = 10;

export function Stats({ onBack }: StatsProps) {
  const [backupRevision, setBackupRevision] = useState(0);
  const streak = getDailyStreak();
  const totalSoloWins = getLifetimeGamesPlayed();
  const mpSummary = getMultiplayerSummary();
  const mpRecent = getMultiplayerStats()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, RECENT_MATCHES_LIMIT);
  const totalGames = totalSoloWins + mpSummary.played;

  return (
    <div className="screen">
      <div className="screen-content gap-8">
        <div className="flex flex-col items-center gap-1">
          <h2 className="heading">Stats</h2>
          <p className="text-sm text-text-muted">
            {totalGames} {totalGames === 1 ? "game" : "games"} played
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

        <SoloStats key={backupRevision} />
        <RivalryHistory />

        <BackupControls
          onRestored={() => setBackupRevision((revision) => revision + 1)}
        />

        <section
          aria-label="Multiplayer"
          className="flex flex-col gap-3 w-full"
        >
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Multiplayer
          </h3>
          {mpSummary.played === 0 ? (
            <div className="card p-4 w-full">
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
                <div className="flex flex-col gap-2 w-full mt-2">
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Recent matches
                  </h4>
                  <ul className="card divide-y divide-border-default w-full">
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
          className="btn-ghost touch-manipulation min-h-11"
          onClick={onBack}
        >
          ← Back
        </button>
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
    <div className="card p-4 w-full">
      <div className="grid grid-cols-4 gap-3 text-center">
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
          className={`text-sm font-semibold ${DIFFICULTY_TEXT_COLORS[difficulty]}`}
        >
          {DIFFICULTY_LABELS[difficulty]}
        </span>
        <span className="text-xs text-text-muted">
          {stats.wins}W · {stats.losses}L
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
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
  const outcomeColor = match.won ? "text-positive-text" : "text-negative-text";
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-text-primary truncate">
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
        <span className={`text-sm font-semibold ${outcomeColor}`}>
          {match.won ? "Won" : "Lost"}
        </span>
        <span className="text-[11px] text-text-muted font-mono tabular-nums">
          {formatTime(match.time)}
        </span>
      </div>
    </li>
  );
}
