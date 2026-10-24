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
  /** Who asked for the rematch, when it is not simply the winner. */
  askedBy?: string | undefined;
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
  askedBy,
  onShowResult,
}: MultiplayerHeaderExtraProps) {
  if (gameOver && !iFinished) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-raised border border-border-default text-sm text-text-secondary">
          <p className="flex-1">
            <span className="font-semibold text-text-primary">
              {rematch === "invited"
                ? askedBy || gameOver.winnerName
                : gameOver.winnerName}
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
      // The paired bars give back the bottom margin they would otherwise
      // push the board down by.
      <div
        className={`w-full max-w-[min(100vw-2rem,28rem)] flex flex-col gap-1.5 ${opponents.length > 1 ? "mb-1" : "mb-3"}`}
      >
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
 * who is ahead, and the bars pair up two to a row so four of them take
 * no more height than the 1v1 pair — the smallest phones have none to
 * spare above the board.
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
  const bars = (
    <>
      <ProgressBar
        label="You"
        percent={myPercent}
        color="bg-accent"
        compact={!solo}
      />
      {opponents.map((o) => {
        const name = solo ? "Opponent" : o.name;
        return (
          <ProgressBar
            key={o.id}
            label={reconnecting ? `${name} (reconnecting...)` : name}
            percent={o.completionPercent}
            color={solo ? "bg-opponent" : ""}
            fill={solo ? undefined : o.color}
            compact={!solo}
          />
        );
      })}
    </>
  );
  if (solo) return bars;
  return <div className="grid grid-cols-2 gap-x-4 gap-y-1">{bars}</div>;
}
