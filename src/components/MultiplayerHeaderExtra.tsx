import type { Reaction } from "../hooks/mp-connection.ts";
import { OpponentReaction } from "./OpponentReaction.tsx";
import { OpponentSilhouette } from "./OpponentSilhouette.tsx";
import { ProgressBar } from "./ProgressBar.tsx";

type MultiplayerHeaderExtraProps = {
  gameOver: { winnerId: string; winnerName: string } | null;
  iFinished: boolean;
  showOpponentProgress: boolean;
  opponentProgress: {
    cellsRemaining: number;
    completionPercent: number;
  } | null;
  /** The opponent's silhouette, from presence. Null until they publish one. */
  opponentMask: string | null;
  /** Their standing reaction, from the same channel. */
  opponentReaction: Reaction | null;
  opponentDisconnected: boolean;
  myPercent: number;
  myCellsRemaining: number;
  /** The shared puzzle, so the silhouette can discount the givens. */
  puzzle: string;
};

export function MultiplayerHeaderExtra({
  gameOver,
  iFinished,
  showOpponentProgress,
  opponentProgress,
  opponentMask,
  opponentReaction,
  opponentDisconnected,
  myPercent,
  myCellsRemaining,
  puzzle,
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
        {showOpponentProgress && opponentProgress && (
          <RaceRow
            myPercent={myPercent}
            myCellsRemaining={myCellsRemaining}
            opponentLabel="Opponent"
            opponentProgress={opponentProgress}
            opponentMask={opponentMask}
            opponentReaction={opponentReaction}
            puzzle={puzzle}
          />
        )}
      </div>
    );
  }

  if (showOpponentProgress && opponentProgress) {
    return (
      <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3">
        <RaceRow
          myPercent={myPercent}
          myCellsRemaining={myCellsRemaining}
          opponentLabel={
            opponentDisconnected ? "Opponent (reconnecting...)" : "Opponent"
          }
          opponentProgress={opponentProgress}
          opponentMask={opponentMask}
          opponentReaction={opponentReaction}
          puzzle={puzzle}
        />
      </div>
    );
  }

  return null;
}

/**
 * Both bars plus the opponent's grid, side by side. The silhouette is
 * sized to the stacked bars beside it, so the race readout costs the
 * header no extra height on the smallest phone.
 */
function RaceRow({
  myPercent,
  myCellsRemaining,
  opponentLabel,
  opponentProgress,
  opponentMask,
  opponentReaction,
  puzzle,
}: {
  myPercent: number;
  myCellsRemaining: number;
  opponentLabel: string;
  opponentProgress: { cellsRemaining: number; completionPercent: number };
  opponentMask: string | null;
  opponentReaction: Reaction | null;
  puzzle: string;
}) {
  return (
    <div className="relative flex items-center gap-2.5">
      <OpponentReaction reaction={opponentReaction} />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <ProgressBar
          label="You"
          percent={myPercent}
          remaining={myCellsRemaining}
          color="bg-accent"
        />
        <ProgressBar
          label={opponentLabel}
          percent={opponentProgress.completionPercent}
          remaining={opponentProgress.cellsRemaining}
          color="bg-opponent"
        />
      </div>
      <OpponentSilhouette mask={opponentMask ?? ""} puzzle={puzzle} />
    </div>
  );
}
