import { Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChallengeComparison } from "../lib/challenge.ts";
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
  tip?: string | undefined;
  onDismissTip?: (() => void) | undefined;
  /** Verdict against the "beat my time" challenger, when there was one. */
  challengeResult?: ChallengeComparison | null | undefined;
  /** A "beat my time" link to share; its absence hides the action. */
  challengeLink?: { url: string; text: string } | undefined;
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
  difficulty,
  isMultiplayer,
  onRematch,
  onNewGame,
  stats,
  isNewPB,
  hintsUsed,
  streakInfo,
  isDaily,
  tip,
  onDismissTip,
  challengeResult,
  challengeLink,
}: GameResultProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const challengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      if (challengeTimerRef.current !== null) {
        clearTimeout(challengeTimerRef.current);
      }
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

  const handleShare = () => {
    const text = buildShareText({
      difficulty,
      time,
      isNewPB,
      hintsUsed,
      streakInfo,
      isDaily,
    });
    // Only claim "Copied!" once the write actually landed — on iOS the
    // promise rejects when transient activation is lost.
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (copiedTimerRef.current !== null) {
          clearTimeout(copiedTimerRef.current);
        }
        copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Copy failed (permissions, lost activation) — leave the
        // button label unchanged so the player can try again.
      });
  };

  // Same order as the lobby invite: the native share sheet first, the
  // clipboard when there is none (desktop) or it fails for a reason
  // other than the player backing out of it.
  const handleChallenge = async () => {
    if (!challengeLink) return;
    if (navigator.share) {
      try {
        await navigator.share(challengeLink);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(
        `${challengeLink.text} ${challengeLink.url}`,
      );
    } catch {
      return;
    }
    setChallengeCopied(true);
    if (challengeTimerRef.current !== null) {
      clearTimeout(challengeTimerRef.current);
    }
    challengeTimerRef.current = setTimeout(
      () => setChallengeCopied(false),
      2000,
    );
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
        className="modal-panel gap-5 max-w-sm sm:max-w-md w-full relative"
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
          <span className="text-5xl font-mono font-extrabold tabular-nums text-text-primary leading-none">
            {time}
          </span>
          {isNewPB && !isMultiplayer && (
            <span className="text-sm font-bold text-accent">
              New Personal Best!
            </span>
          )}
          {challengeResult && (
            <div className="flex flex-col items-center gap-0.5 px-3 text-center">
              <span
                className={`text-sm font-bold ${
                  challengeResult.outcome === "won"
                    ? "text-accent"
                    : "text-text-secondary"
                }`}
              >
                {challengeResult.headline}
              </span>
              {challengeResult.hintNote && (
                <span className="text-xs text-text-muted">
                  {challengeResult.hintNote}
                </span>
              )}
            </div>
          )}
        </div>

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
          {!isMultiplayer && (
            <div
              // Side by side when they fit, stacked on the narrowest
              // phones rather than wrapping a label mid-phrase.
              className="flex flex-wrap justify-center gap-x-2 w-full"
            >
              <button
                type="button"
                className={`btn btn-ghost py-2 px-3 whitespace-nowrap ${challengeLink ? "" : "w-full"}`}
                onClick={handleShare}
              >
                {copied ? "Copied!" : "Share Result"}
              </button>
              {challengeLink && (
                <button
                  type="button"
                  className="btn btn-ghost py-2 px-3"
                  onClick={handleChallenge}
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-accent">
                    <Swords size={15} aria-hidden="true" />
                    {challengeCopied
                      ? "Link copied!"
                      : challengeResult
                        ? "Challenge back"
                        : "Challenge a friend"}
                  </span>
                </button>
              )}
            </div>
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
