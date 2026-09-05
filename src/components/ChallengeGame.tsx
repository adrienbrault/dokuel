import { useEffect, useState } from "react";
import { challengeGameKey, type FriendChallenge } from "../lib/challenge.ts";
import { ASSIST_LEVEL_LABELS, DIFFICULTY_LABELS } from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import { loadGame } from "../lib/game-storage.ts";
import { trackProductEvent } from "../lib/product-events.ts";
import { SoloGame } from "./SoloGame.tsx";

export function ChallengeGame({
  challenge,
  onBack,
  onLiveChallenge,
}: {
  challenge: FriendChallenge;
  onBack: () => void;
  onLiveChallenge?: (() => void) | undefined;
}) {
  const [started, setStarted] = useState(false);
  const gameKey = challengeGameKey(challenge);
  useEffect(() => {
    trackProductEvent("challenge_open", "friend");
  }, []);
  if (started)
    return (
      <SoloGame
        difficulty={challenge.difficulty}
        gameKey={gameKey}
        initialPuzzle={challenge.puzzle}
        assistLevel={challenge.assistLevel}
        challenge={challenge}
        title={`Friend challenge · target ${formatTime(challenge.timeSeconds)}`}
        onBack={onBack}
      />
    );
  return (
    <div className="screen">
      <div className="screen-content gap-6 py-8 text-center">
        <p className="label">Time challenge · asynchronous</p>
        <h1 className="heading-xl">Beat {formatTime(challenge.timeSeconds)}</h1>
        <p className="caption">
          The exact same {DIFFICULTY_LABELS[challenge.difficulty].toLowerCase()}{" "}
          puzzle, at your own pace.
        </p>
        <div className="card w-full p-4 space-y-2">
          <p className="font-semibold">
            {ASSIST_LEVEL_LABELS[challenge.assistLevel]} assistance
          </p>
          <p className="caption">
            {challenge.hintsUsed === 0
              ? "Your friend used no hints."
              : `Your friend used ${challenge.hintsUsed} hint${challenge.hintsUsed === 1 ? "" : "s"}.`}
          </p>
          <p className="caption">
            Assistance stays fixed for a fair comparison. You can still ask for
            hints; extra hints make this a practice result.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-lg btn-primary w-full"
          onClick={() => setStarted(true)}
        >
          {loadGame(gameKey) ? "Continue challenge" : "Start challenge"}
        </button>
        {onLiveChallenge && (
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={onLiveChallenge}
          >
            Play live instead
          </button>
        )}
        <button type="button" className="btn-ghost min-h-11" onClick={onBack}>
          Back to home
        </button>
      </div>
    </div>
  );
}
