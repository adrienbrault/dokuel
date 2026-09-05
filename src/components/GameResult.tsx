import { useEffect, useRef, useState } from "react";
import {
  buildChallengeShareText,
  describeChallengeOutcome,
  type SoloChallenge,
} from "../lib/challenge.ts";
import {
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
} from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import type { Difficulty } from "../lib/types.ts";

type GameResultProps = {
  isWinner: boolean;
  time: string;
  timeSeconds?: number | undefined;
  difficulty?: Difficulty | undefined;
  isMultiplayer?: boolean | undefined;
  onRematch?: (() => void) | undefined;
  onNewGame: () => void;
  stats?: { gamesPlayed: number; bestTime: number; averageTime: number } | null;
  isNewPB?: boolean | undefined;
  hintsUsed?: number | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
  isDaily?: boolean | undefined;
  /** The time this board was opened to beat, if the link carried one. */
  challenge?: SoloChallenge | undefined;
  /** Link that replays this exact board against the player's time. */
  challengeUrl?: string | undefined;
  tip?: string | undefined;
  onDismissTip?: (() => void) | undefined;
};

export function buildShareText({
  difficulty,
  time,
  isNewPB,
  hintsUsed,
  streakInfo,
  isDaily,
}: {
  difficulty?: Difficulty | undefined;
  time: string;
  isNewPB?: boolean | undefined;
  hintsUsed?: number | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
  isDaily?: boolean | undefined;
}): string {
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

export function GameResult({
  isWinner,
  time,
  timeSeconds,
  difficulty,
  isMultiplayer,
  onRematch,
  onNewGame,
  stats,
  isNewPB,
  hintsUsed,
  streakInfo,
  isDaily,
  challenge,
  challengeUrl,
  tip,
  onDismissTip,
}: GameResultProps) {
  const outcome =
    challenge && timeSeconds !== undefined
      ? describeChallengeOutcome(challenge, timeSeconds)
      : null;
  const [copied, setCopied] = useState<"result" | "challenge" | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  // Modal focus management: move focus onto the primary action when the
  // result opens (this is also what makes screen readers announce the
  // outcome), restore it when the dialog goes away, and keep Tab
  // cycling inside — without this, Tab walked the covered board.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const primary = panelRef.current?.querySelector<HTMLElement>("button");
    primary?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>("button, [href], [tabindex]"),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Only claim "Copied!" once the write actually landed — on iOS the
  // promise rejects when transient activation is lost.
  const copyToClipboard = (text: string, action: "result" | "challenge") => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(action);
        if (copiedTimerRef.current !== null) {
          clearTimeout(copiedTimerRef.current);
        }
        copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        // Copy failed (permissions, lost activation) — leave the
        // button label unchanged so the player can try again.
      });
  };

  const handleShare = () => {
    copyToClipboard(
      buildShareText({
        difficulty,
        time,
        isNewPB,
        hintsUsed,
        streakInfo,
        isDaily,
      }),
      "result",
    );
  };

  const handleChallenge = () => {
    if (!challengeUrl || !difficulty) return;
    const text = buildChallengeShareText({
      difficulty,
      time,
      url: challengeUrl,
    });
    // The share sheet is the whole point on a phone: it drops the
    // link straight into the thread the friend is already in.
    if (typeof navigator.share === "function") {
      navigator.share({ text }).catch(() => {
        // Dismissed or unsupported payload — nothing to report.
      });
      return;
    }
    copyToClipboard(text, "challenge");
  };

  return (
    <div className="modal-overlay p-6">
      {isWinner && (
        <div className="confetti-container">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-result-title"
        onKeyDown={trapTab}
        ref={panelRef}
        className="modal-panel gap-5 short:gap-3 short:p-5 max-w-sm sm:max-w-md w-full relative"
      >
        <div className="flex flex-col items-center gap-2.5">
          <span
            className={`flex items-center justify-center w-16 h-16 rounded-full text-4xl animate-emoji-bounce ${
              isWinner ? "bg-accent-light" : "bg-bg-inset"
            }`}
          >
            {isWinner ? "🎉" : "👏"}
          </span>
          <h2 id="game-result-title" className="heading">
            {isWinner ? "You Won!" : "Puzzle Complete!"}
          </h2>
          {difficulty && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${DIFFICULTY_BADGE_CLASSES[difficulty]}`}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5 w-full rounded-2xl bg-bg-inset py-4">
          <span className="text-5xl short:text-4xl font-mono font-extrabold tabular-nums text-text-primary leading-none">
            {time}
          </span>
          {isNewPB && !isMultiplayer && (
            <span className="text-sm font-bold text-accent">
              New Personal Best!
            </span>
          )}
        </div>

        {outcome && (
          <div className="flex flex-col items-center gap-0.5 w-full">
            <span
              className={`text-base font-bold text-center ${
                outcome.beaten ? "text-accent" : "text-text-primary"
              }`}
            >
              {outcome.headline}
            </span>
            {outcome.delta && (
              <span className="caption text-xs">{outcome.delta}</span>
            )}
          </div>
        )}

        {stats && !isMultiplayer && (
          <div className="grid grid-cols-3 gap-2.5 w-full text-center">
            <StatTile label="Played" value={String(stats.gamesPlayed)} />
            <StatTile label="Best" value={formatTime(stats.bestTime)} />
            <StatTile label="Average" value={formatTime(stats.averageTime)} />
          </div>
        )}

        {streakInfo && streakInfo.currentStreak > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-accent font-semibold">
            <span>{streakInfo.currentStreak}-day streak!</span>
            {streakInfo.currentStreak >= streakInfo.longestStreak &&
              streakInfo.currentStreak > 1 && (
                <span className="text-xs font-normal text-text-muted">
                  New record!
                </span>
              )}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          {onRematch && (
            <button
              type="button"
              className="btn btn-primary w-full py-3 text-lg"
              onClick={onRematch}
            >
              {isMultiplayer ? "Rematch" : "Play Again"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary w-full py-3 text-lg"
            onClick={onNewGame}
          >
            New Game
          </button>
          {challengeUrl && difficulty && (
            <button
              type="button"
              className="btn btn-secondary w-full py-3 text-lg"
              onClick={handleChallenge}
            >
              {copied === "challenge" ? "Copied!" : "Challenge a friend"}
            </button>
          )}
          {!isMultiplayer && (
            <button
              type="button"
              className="btn btn-ghost w-full py-2"
              onClick={handleShare}
            >
              {copied === "result" ? "Copied!" : "Share Result"}
            </button>
          )}
        </div>
        {tip && (
          <button
            type="button"
            className="text-xs text-text-muted text-center leading-relaxed hover:text-text-secondary transition-colors"
            onClick={onDismissTip}
          >
            {tip} <span className="underline">Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-inset py-2.5">
      <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
