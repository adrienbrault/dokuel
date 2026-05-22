import { useEffect, useState } from "react";
import { parseChallengeUrl } from "../lib/challenge.ts";
import type { Challenge } from "../lib/types.ts";
import { ChallengeGame } from "./ChallengeGame.tsx";

type DecodeState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; challenge: Challenge };

/**
 * Decodes the async-challenge artifact from the URL hash — asynchronous,
 * since the codec gunzips — then hands off to ChallengeGame. A bad or
 * outdated link lands on a friendly dead end instead of crashing or
 * being misrouted to a multiplayer room.
 */
export function ChallengeScreen({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<DecodeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    parseChallengeUrl({
      pathname: window.location.pathname,
      hash: window.location.hash,
    })
      .then((challenge) => {
        if (cancelled) return;
        setState(
          challenge ? { status: "ready", challenge } : { status: "error" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="screen">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-pulse">🧩</span>
          <p className="caption">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="screen">
        <div className="screen-content">
          <div className="card flex w-full flex-col items-center gap-4 px-8 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-inset text-4xl animate-emoji-bounce">
              🧩
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="heading">Challenge unavailable</h2>
              <p className="caption">
                This challenge link is invalid or out of date.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-md btn-primary"
              onClick={onBack}
            >
              Back to Dokuel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ChallengeGame challenge={state.challenge} onBack={onBack} />;
}
