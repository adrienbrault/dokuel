import { ProgressBar } from "./ProgressBar.tsx";

type MultiplayerHeaderExtraProps = {
  gameOver: { winnerId: string; winnerName: string } | null;
  iFinished: boolean;
  showOpponentProgress: boolean;
  opponentProgress: { completionPercent: number } | null;
  opponentDisconnected: boolean;
  myPercent: number;
};

export function MultiplayerHeaderExtra({
  gameOver,
  iFinished,
  showOpponentProgress,
  opponentProgress,
  opponentDisconnected,
  myPercent,
}: MultiplayerHeaderExtraProps) {
  if (gameOver && !iFinished) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-2">
        <div className="px-3.5 py-2.5 rounded-xl bg-bg-raised border border-border-default shadow-sm text-sm text-text-secondary text-center">
          <span className="font-semibold text-text-primary">
            {gameOver.winnerName}
          </span>{" "}
          finished first — keep going to complete your puzzle.
        </div>
        {showOpponentProgress && opponentProgress && (
          <div className="flex flex-col gap-1.5">
            <ProgressBar label="You" percent={myPercent} color="bg-accent" />
            <ProgressBar
              label="Opponent"
              percent={opponentProgress.completionPercent}
              color="bg-rose-400"
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
          color="bg-rose-400"
        />
      </div>
    );
  }

  return null;
}
