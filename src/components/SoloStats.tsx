import { useMemo, useState } from "react";
import {
  ASSIST_LEVEL_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIFFICULTY_TEXT_COLORS,
} from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import {
  type AssistLevelStats,
  type GameOrigin,
  getStatsByAssistLevel,
} from "../lib/stats.ts";
import type { Difficulty } from "../lib/types.ts";

const SOURCES: Record<GameOrigin, string> = {
  generated: "Fresh puzzles",
  daily: "Daily challenges",
  friend: "Friend challenges",
  imported: "Imported puzzles",
  replay: "Replays",
};

export function SoloStats() {
  const [origin, setOrigin] = useState<GameOrigin>("generated");
  return (
    <section aria-label="Solo" className="flex flex-col gap-3 w-full">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
        Solo
      </h3>
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        Puzzle source
        <select
          value={origin}
          onChange={(event) => setOrigin(event.target.value as GameOrigin)}
          className="btn btn-secondary w-full px-3 py-2 text-text-primary"
        >
          {Object.entries(SOURCES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="caption">
        Records stay separate by puzzle source and assistance. Hints exclude a
        solve from its best time.
      </p>
      <div className="flex flex-col gap-4 w-full">
        {DIFFICULTIES.map((difficulty) => (
          <DifficultyStats
            key={difficulty}
            difficulty={difficulty}
            origin={origin}
          />
        ))}
      </div>
    </section>
  );
}

function DifficultyStats({
  difficulty,
  origin,
}: {
  difficulty: Difficulty;
  origin: GameOrigin;
}) {
  const byLevel = useMemo(
    () => getStatsByAssistLevel(difficulty, origin),
    [difficulty, origin],
  );
  const totalWins = byLevel.reduce((sum, s) => sum + s.gamesPlayed, 0);

  return (
    <div className="card p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-sm font-semibold ${DIFFICULTY_TEXT_COLORS[difficulty]}`}
        >
          {DIFFICULTY_LABELS[difficulty]}
        </span>
        {totalWins > 0 && (
          <span className="text-xs text-text-muted">
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
        <p className="text-sm text-text-muted text-center">No games yet</p>
      )}
    </div>
  );
}

function AssistModeRow({ stats }: { stats: AssistLevelStats }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text-primary">
          {ASSIST_LEVEL_LABELS[stats.assistLevel]}
        </span>
        <span className="text-[11px] text-text-muted">
          {stats.gamesPlayed} {stats.gamesPlayed === 1 ? "win" : "wins"}
        </span>
      </div>
      <div className="flex gap-6 text-center">
        <ModeStat
          label="Best"
          value={stats.bestTime === null ? "—" : formatTime(stats.bestTime)}
        />
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
