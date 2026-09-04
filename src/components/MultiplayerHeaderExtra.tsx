import { ProgressBar } from "./ProgressBar.tsx";

type MultiplayerHeaderExtraProps = {
  gameOver: { winnerId: string; winnerName: string } | null;
  iFinished: boolean;
  showOpponentProgress: boolean;
  opponentProgress: { completionPercent: number } | null;
  opponentDisconnected: boolean;
  myPercent: number;
  onAcceptRematch?: (() => void) | undefined;
};

export function MultiplayerHeaderExtra({
  gameOver,
  iFinished,
  showOpponentProgress,
  opponentProgress,
  opponentDisconnected,
  myPercent,
  onAcceptRematch,
}: MultiplayerHeaderExtraProps) {
  if (gameOver && !iFinished) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-2">
        <div className="px-3 py-2 rounded-lg bg-bg-raised border border-border-default text-sm text-text-secondary text-center">
          <span className="font-semibold text-text-primary">
            {gameOver.winnerName}
          </span>{" "}
          finished first — keep going to complete your puzzle.
        </div>
        {onAcceptRematch && (
          <div role="status" className="card px-3 py-2 text-center">
            <p className="text-sm font-semibold">Rematch requested</p>
            <p className="caption">
              Keep solving, or accept a new game. Your current puzzle will end.
            </p>
            <button
              type="button"
              className="btn btn-primary min-h-11 px-4 mt-2"
              onClick={onAcceptRematch}
            >
              Accept rematch
            </button>
          </div>
        )}
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
