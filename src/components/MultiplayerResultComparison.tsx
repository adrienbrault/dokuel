import { formatTime } from "../lib/format.ts";
import type { MultiplayerResult } from "../lib/types.ts";

export type MultiplayerResultComparisonProps = {
  playerId: string;
  opponentName: string;
  results: Record<string, MultiplayerResult>;
  /** Shared epoch instant at which the puzzle became live. */
  startedAt?: number | null | undefined;
  /** Fallback while this player's solved result is still syncing. */
  playerTimeSeconds?: number | undefined;
  /** Used for the first-finisher label when only one result has arrived. */
  winnerId?: string | null | undefined;
};

type ResultRow = {
  id: string;
  label: string;
  seconds: number | null;
  completedAt: number | null;
};

function resultSeconds(
  result: MultiplayerResult | undefined,
  startedAt: number | null | undefined,
): number | null {
  if (!result || typeof startedAt !== "number" || !Number.isFinite(startedAt)) {
    return null;
  }
  const elapsedMs = result.completedAt - startedAt;
  return Number.isFinite(elapsedMs) && elapsedMs >= 0
    ? elapsedMs / 1_000
    : null;
}

function validFallback(seconds: number | undefined): number | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : null;
}

function formatDelta(seconds: number): string {
  return formatTime(Math.max(1, Math.round(seconds)));
}

function finishLabel(
  row: ResultRow,
  other: ResultRow,
  winnerId: string | null | undefined,
): string | null {
  if (row.completedAt !== null && other.completedAt !== null) {
    if (row.completedAt === other.completedAt) return "Tied";
    return row.completedAt < other.completedAt
      ? "Finished first"
      : "Finished second";
  }
  return row.id === winnerId ? "Finished first" : null;
}

export function MultiplayerResultComparison({
  playerId,
  opponentName,
  results,
  startedAt,
  playerTimeSeconds,
  winnerId,
}: MultiplayerResultComparisonProps) {
  const opponentEntry = Object.entries(results).find(([id]) => id !== playerId);
  const opponentId = opponentEntry?.[0] ?? "opponent";
  const opponentResult = opponentEntry?.[1];
  const you: ResultRow = {
    id: playerId,
    label: "You",
    seconds:
      resultSeconds(results[playerId], startedAt) ??
      validFallback(playerTimeSeconds),
    completedAt: results[playerId]?.completedAt ?? null,
  };
  const opponent: ResultRow = {
    id: opponentId,
    label: opponentName || "Opponent",
    seconds: resultSeconds(opponentResult, startedAt),
    completedAt: opponentResult?.completedAt ?? null,
  };

  const youSeconds = you.seconds;
  const opponentSeconds = opponent.seconds;
  if (youSeconds === null && opponentSeconds === null) return null;

  const bothFinished = youSeconds !== null && opponentSeconds !== null;
  const status = bothFinished
    ? youSeconds === opponentSeconds
      ? "Same finish time."
      : youSeconds < opponentSeconds
        ? `You finished ${formatDelta(opponentSeconds - youSeconds)} ahead of ${opponent.label}.`
        : `${opponent.label} finished ${formatDelta(youSeconds - opponentSeconds)} ahead of you.`
    : `Waiting for ${opponent.label} to finish…`;

  return (
    <section
      aria-labelledby="multiplayer-result-comparison-title"
      className="w-full rounded-2xl bg-bg-inset p-3.5"
    >
      <h3
        id="multiplayer-result-comparison-title"
        className="text-sm font-bold text-text-primary text-center mb-2"
      >
        Race results
      </h3>
      <div role="list" className="flex flex-col gap-2">
        {[you, opponent].map((row) => {
          const label = row.id === playerId ? row.label : row.label;
          const placement = finishLabel(
            row,
            row.id === playerId ? opponent : you,
            winnerId,
          );
          return (
            <div
              key={row.id}
              role="listitem"
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-text-primary truncate">
                  {label}
                </span>
                {placement && (
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {placement}
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums font-bold text-text-primary">
                {row.seconds === null ? "—" : formatTime(row.seconds)}
              </span>
            </div>
          );
        })}
      </div>
      <p
        role="status"
        aria-atomic="true"
        className="text-center text-xs font-semibold text-accent mt-2"
      >
        {status}
      </p>
    </section>
  );
}
