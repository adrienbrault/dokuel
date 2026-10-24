import type { RematchState } from "./MatchResult.tsx";
import { ProgressBar } from "./ProgressBar.tsx";

/** One other player's race, as their progress bar shows it. */
export type OpponentBar = {
  id: string;
  name: string;
  color: string;
  completionPercent: number;
};

type MultiplayerHeaderExtraProps = {
  gameOver: { winnerId: string; winnerName: string } | null;
  iFinished: boolean;
  showOpponentProgress: boolean;
  opponents: OpponentBar[];
  opponentDisconnected: boolean;
  myPercent: number;
  /** Where the rematch handshake stands from our side. */
  rematch?: RematchState | undefined;
  /** Brings back the result a loser set aside to keep solving. */
  onShowResult?: (() => void) | undefined;
};

export function MultiplayerHeaderExtra({
  gameOver,
  iFinished,
  showOpponentProgress,
  opponents,
  opponentDisconnected,
  myPercent,
  rematch = "idle",
  onShowResult,
}: MultiplayerHeaderExtraProps) {
  if (gameOver && !iFinished) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-raised border border-border-default text-sm text-text-secondary">
          <p className="flex-1">
            <span className="font-semibold text-text-primary">
              {gameOver.winnerName}
            </span>{" "}
            {rematch === "invited"
              ? "wants a rematch."
              : "finished first. Keep going, or call it here."}
          </p>
          {onShowResult && (
            <button
              type="button"
              className="btn btn-md btn-primary shrink-0"
              onClick={onShowResult}
            >
              {rematch === "invited" ? "Answer" : "Results"}
            </button>
          )}
        </div>
        {showOpponentProgress && opponents.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <RaceBars
              opponents={opponents}
              myPercent={myPercent}
              reconnecting={false}
            />
          </div>
        )}
      </div>
    );
  }

  if (showOpponentProgress && opponents.length > 0) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-1.5">
        <RaceBars
          opponents={opponents}
          myPercent={myPercent}
          reconnecting={opponentDisconnected}
        />
      </div>
    );
  }

  return null;
}

/**
 * Our bar, then one per opponent. A lone opponent keeps the 1v1 look;
 * in a bigger room each bar needs its player's name and color to tell
 * who is ahead.
 */
function RaceBars({
  opponents,
  myPercent,
  reconnecting,
}: {
  opponents: OpponentBar[];
  myPercent: number;
  reconnecting: boolean;
}) {
  const solo = opponents.length === 1;
  return (
    <>
      <ProgressBar label="You" percent={myPercent} color="bg-accent" />
      {opponents.map((o) => {
        const name = solo ? "Opponent" : o.name;
        return (
          <ProgressBar
            key={o.id}
            label={reconnecting ? `${name} (reconnecting...)` : name}
            percent={o.completionPercent}
            color={solo ? "bg-opponent" : ""}
            fill={solo ? undefined : o.color}
          />
        );
      })}
    </>
  );
}
