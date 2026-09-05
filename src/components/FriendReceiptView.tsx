import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABELS } from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import {
  compareFriendReceipt,
  type FriendReceipt,
  type ReceiptSide,
} from "../lib/friend-receipt.ts";
import { trackProductEvent } from "../lib/product-events.ts";
import { recordRivalry } from "../lib/rivalry.ts";

type FriendReceiptViewProps = {
  receipt: FriendReceipt;
  onBack: () => void;
  onChallengeAgain?: ((side: ReceiptSide) => void) | undefined;
  onBestOfThree?: ((side: ReceiptSide) => void) | undefined;
  onLiveChallenge?: (() => void) | undefined;
};

export function FriendReceiptView({
  receipt,
  onBack,
  onChallengeAgain,
  onBestOfThree,
  onLiveChallenge,
}: FriendReceiptViewProps) {
  const comparison = compareFriendReceipt(receipt);
  const [selectedSide, setSelectedSide] = useState<ReceiptSide | null>(null);
  const trackedReceipt = useRef<string | null>(null);
  const canStartSeries = comparison.outcome !== "practice" && !receipt.series;
  const canContinueSeries =
    receipt.series !== undefined &&
    receipt.series.gameNumber < 3 &&
    receipt.series.challengerWins < 2 &&
    receipt.series.friendWins < 2;
  useEffect(() => {
    recordRivalry(receipt);
    if (trackedReceipt.current === receipt.matchId) return;
    trackedReceipt.current = receipt.matchId;
    trackProductEvent("receipt_open", "friend");
  }, [receipt]);

  const handleRepeat = (action: ((side: ReceiptSide) => void) | undefined) => {
    if (!action || !selectedSide) return;
    action(selectedSide);
  };

  return (
    <div className="screen">
      <div className="screen-content gap-5 py-8">
        <p className="label text-center">Friend comparison</p>
        <h1 className="heading-xl text-center">Race result</h1>
        <p className="caption text-center">
          Time challenge · asynchronous ·{" "}
          {DIFFICULTY_LABELS[receipt.challenge.difficulty]}
        </p>

        <section
          aria-labelledby="friend-receipt-results-title"
          className="card w-full p-4 space-y-3"
        >
          <h2 id="friend-receipt-results-title" className="heading text-lg">
            {comparison.outcome === "practice"
              ? "Practice comparison"
              : comparison.outcome === "tie"
                ? "Same finish time"
                : `${comparison.outcome === "challenger" ? receipt.challenger.name : receipt.friend.name} finished first`}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <ResultTile
              name={receipt.challenger.name}
              time={receipt.challenger.timeSeconds}
              winner={comparison.outcome === "challenger"}
            />
            <ResultTile
              name={receipt.friend.name}
              time={receipt.friend.timeSeconds}
              winner={comparison.outcome === "friend"}
            />
          </div>
          {comparison.outcome === "practice" ? (
            <p role="status" className="caption text-center">
              Extra help was used, so this result is practice only.
            </p>
          ) : comparison.outcome === "tie" ? (
            <p role="status" className="caption text-center">
              You finished at the same time.
            </p>
          ) : (
            <p role="status" className="text-center font-semibold text-accent">
              {formatTime(comparison.deltaSeconds)} faster
            </p>
          )}
        </section>

        {receipt.series && (
          <p className="caption text-center" role="status">
            Game {receipt.series.gameNumber} of 3 · Score{" "}
            {receipt.challenger.name} {receipt.series.challengerWins}–
            {receipt.series.friendWins} {receipt.friend.name}
          </p>
        )}

        <div className="card w-full p-4 space-y-2">
          <p className="font-semibold">Keep playing together</p>
          <p className="caption">
            Time challenges are asynchronous. A live room gives both players a
            shared countdown and finish times.
          </p>
          {onLiveChallenge && (
            <button
              type="button"
              className="btn btn-secondary w-full min-h-11"
              onClick={onLiveChallenge}
            >
              Play live instead
            </button>
          )}
        </div>

        <fieldset className="card w-full p-4 space-y-3">
          <legend className="px-1 font-semibold">Choose your name</legend>
          <p className="caption">
            Select your side before setting the next target.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-xl bg-bg-inset p-3 cursor-pointer">
              <input
                type="radio"
                name="receipt-side"
                value="challenger"
                checked={selectedSide === "challenger"}
                onChange={() => setSelectedSide("challenger")}
              />
              <span className="truncate">I am {receipt.challenger.name}</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-bg-inset p-3 cursor-pointer">
              <input
                type="radio"
                name="receipt-side"
                value="friend"
                checked={selectedSide === "friend"}
                onChange={() => setSelectedSide("friend")}
              />
              <span className="truncate">I am {receipt.friend.name}</span>
            </label>
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 w-full">
          {onChallengeAgain && (
            <button
              type="button"
              className="btn btn-primary w-full min-h-11"
              onClick={() => handleRepeat(onChallengeAgain)}
              disabled={!selectedSide}
            >
              Challenge again
            </button>
          )}
          {onBestOfThree && canStartSeries && (
            <button
              type="button"
              className="btn btn-secondary w-full min-h-11"
              onClick={() => handleRepeat(onBestOfThree)}
              disabled={!selectedSide}
            >
              Start best of 3
            </button>
          )}
          {onBestOfThree && canContinueSeries && (
            <button
              type="button"
              className="btn btn-secondary w-full min-h-11"
              onClick={() => handleRepeat(onBestOfThree)}
              disabled={!selectedSide}
            >
              Continue best of 3
            </button>
          )}
          <button type="button" className="btn-ghost min-h-11" onClick={onBack}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultTile({
  name,
  time,
  winner,
}: {
  name: string;
  time: number;
  winner: boolean;
}) {
  return (
    <div
      className={`rounded-xl bg-bg-inset py-3 ${winner ? "ring-2 ring-accent" : ""}`}
    >
      <div className="text-sm font-semibold text-text-secondary truncate px-2">
        {name}
      </div>
      <div className="text-2xl font-bold text-text-primary font-mono tabular-nums">
        {formatTime(time)}
      </div>
    </div>
  );
}
