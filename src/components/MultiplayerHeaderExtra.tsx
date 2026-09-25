import type { RematchState } from "./MatchResult.tsx";
import { ProgressBar } from "./ProgressBar.tsx";

type MultiplayerHeaderExtraProps = {
  gameOver: { winnerId: string; winnerName: string } | null;
  iFinished: boolean;
  showOpponentProgress: boolean;
  opponentProgress: { completionPercent: number } | null;
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
  opponentProgress,
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
        {showOpponentProgress && opponentProgress && (
          <div className="flex flex-col gap-1.5">
            <ProgressBar label="You" percent={myPercent} color="bg-accent" />
            <ProgressBar
              label="Opponent"
              percent={opponentProgress.completionPercent}
              color="bg-opponent"
            />
          </div>
        )}
      </div>
    );
  }

  if (showOpponentProgress && opponentProgress) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-1.5">
        <ProgressBar label="You" percent={myPercent} color="bg-accent" />
        <ProgressBar
          label={
            opponentDisconnected ? "Opponent (reconnecting...)" : "Opponent"
          }
          percent={opponentProgress.completionPercent}
          color="bg-opponent"
        />
      </div>
    );
  }

  return null;
}
