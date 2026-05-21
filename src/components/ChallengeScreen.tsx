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
        <p className="caption">Loading challenge...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="screen">
        <div className="screen-content gap-4 items-center text-center">
          <h2 className="heading">Challenge unavailable</h2>
          <p className="caption">
            This challenge link is invalid or out of date.
          </p>
          <button type="button" className="btn btn-primary" onClick={onBack}>
            Back to Dokuel
          </button>
        </div>
      </div>
    );
  }

  return <ChallengeGame challenge={state.challenge} onBack={onBack} />;
}
