import { useMemo } from "react";
import { hashCode } from "../lib/daily.ts";
import {
  createFriendRoundPlan,
  type FriendReceipt,
  type FriendRoundMode,
  type ReceiptSide,
} from "../lib/friend-receipt.ts";
import { generatePuzzleWithSolution } from "../lib/sudoku.ts";
import { SoloGame } from "./SoloGame.tsx";

type FriendRoundSetupProps = {
  receipt: FriendReceipt;
  side: ReceiptSide;
  mode: FriendRoundMode;
  onBack: () => void;
};

export function FriendRoundSetup({
  receipt,
  side,
  mode,
  onBack,
}: FriendRoundSetupProps) {
  const plan = useMemo(
    () => createFriendRoundPlan(receipt, side, mode),
    [receipt, side, mode],
  );
  const generated = useMemo(
    () => (plan ? generatePuzzleWithSolution(plan.difficulty) : null),
    [plan],
  );

  if (!plan || !generated) {
    return (
      <div className="screen">
        <div className="screen-content gap-5 py-10 text-center">
          <p className="label">Best of 3</p>
          <h1 className="heading-xl">Series complete</h1>
          <p className="caption">
            This series has no more competitive rounds to set.
          </p>
          <button type="button" className="btn btn-primary" onClick={onBack}>
            Back to result
          </button>
        </div>
      </div>
    );
  }

  const setterName =
    side === "challenger" ? plan.challengerName : plan.friendName;
  const gameKey = `friend-round-${hashCode(
    `${receipt.matchId}:${side}:${mode}:${plan.series?.gameNumber ?? "again"}`,
  )}`;

  return (
    <SoloGame
      key={gameKey}
      difficulty={plan.difficulty}
      gameKey={gameKey}
      initialPuzzle={generated.puzzle}
      assistLevel={plan.assistLevel}
      title={`Set next round target · ${setterName}`}
      friendRound={plan}
      onBack={onBack}
    />
  );
}
