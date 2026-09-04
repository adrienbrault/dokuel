import { useEffect, useRef, useState } from "react";
import { challengePath, type FriendChallenge } from "../lib/challenge.ts";
import { ASSIST_LEVEL_LABELS, DIFFICULTY_LABELS } from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import type { Difficulty } from "../lib/types.ts";

export function buildShareText({
  difficulty,
  time,
  isNewPB,
  hintsUsed,
  streakInfo,
  isDaily,
  shareChallenge,
}: {
  difficulty?: Difficulty | undefined;
  time: string;
  isNewPB?: boolean | undefined;
  hintsUsed?: number | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
  isDaily?: boolean | undefined;
  shareChallenge?: FriendChallenge | undefined;
}): string {
  if (shareChallenge) {
    const hints = `${shareChallenge.hintsUsed} hint${shareChallenge.hintsUsed === 1 ? "" : "s"}`;
    return `Beat my ${DIFFICULTY_LABELS[shareChallenge.difficulty]} Sudoku time: ${formatTime(shareChallenge.timeSeconds)}\n${ASSIST_LEVEL_LABELS[shareChallenge.assistLevel]} assistance · ${hints}\n${window.location.origin}${challengePath(shareChallenge)}`;
  }
  const title = isDaily ? "Dokuel Daily" : "Dokuel";
  const diffLabel = difficulty ? ` ${DIFFICULTY_LABELS[difficulty]}` : "";
  const hints = hintsUsed
    ? ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}`
    : "";
  const pb = isNewPB ? " ⚡" : "";
  const streak =
    isDaily && streakInfo && streakInfo.currentStreak > 0
      ? `\n🔥 ${streakInfo.currentStreak}-day streak`
      : "";

  return `${title}${diffLabel}\n⏱ ${time}${hints}${pb}${streak}\nhttps://dokuel.com`;
}

export function ResultShare(props: Parameters<typeof buildShareText>[0]) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );
  const text = buildShareText(props);
  async function share() {
    setFailed(false);
    if (props.shareChallenge && navigator.share) {
      try {
        await navigator.share({ title: "Dokuel friend challenge", text });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <>
      <button
        type="button"
        className={`btn w-full min-h-11 py-2 ${props.shareChallenge ? "btn-primary" : "btn-ghost"}`}
        onClick={share}
      >
        {copied
          ? "Copied!"
          : props.shareChallenge
            ? "Challenge a friend"
            : "Share Result"}
      </button>
      {failed && (
        <div className="w-full">
          <p role="status" className="caption">
            Could not share automatically. Copy the text below.
          </p>
          <textarea
            aria-label="Share text"
            readOnly
            value={text}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full mt-2 rounded-lg border border-border-default bg-bg-inset p-2 text-xs"
            rows={3}
          />
        </div>
      )}
    </>
  );
}
