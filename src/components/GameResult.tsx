import { useEffect, useRef, useState } from "react";
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
}: GameResultProps) {
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // The panel renders last in the DOM, after the board and the number pad,
  // so without moving focus a keyboard user had to tab past ~95 controls
  // to reach "Play Again". Focusing the primary action on mount also gives
  // a screen reader the dialog's name and its first control at once.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Keep Tab inside the panel while it is up. The board behind it is still
  // in the accessibility tree, and tabbing into a board you have already
  // finished — and can no longer change — is a dead end.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable || focusable.length === 0) return;
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
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the key
    // handler implements the focus trap the dialog role requires.
    <div
      className="modal-overlay p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-result-title"
      onKeyDown={handleKeyDown}
    >
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
          <h2 className="heading" id="game-result-title">
            {isWinner ? "You Won!" : "Puzzle Complete!"}
          </h2>
          {difficulty && (
            <span className={`chip ${DIFFICULTY_BADGE_CLASSES[difficulty]}`}>
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
        </div>
        {/* The time is the result. Everything else on this panel is
            context for it, so it gets the panel's largest type and, when
            it is a record, the accent. */}
        <div
          className={`flex flex-col items-center gap-1.5 w-full rounded-panel py-5 ${
            isNewPB && !isMultiplayer
              ? "bg-accent-light ring-1 ring-accent/25"
              : "bg-bg-inset"
          }`}
        >
          <span
            className={`text-[3.25rem] font-mono font-extrabold tabular-nums leading-none ${
              isNewPB && !isMultiplayer ? "text-accent" : "text-text-primary"
            }`}
          >
            {time}
          </span>
          {isNewPB && !isMultiplayer && (
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              New personal best
            </span>
          )}
        </div>

        {stats && !isMultiplayer && (
          <div className="grid grid-cols-3 w-full text-center rounded-panel bg-bg-inset divide-x divide-border-default">
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
              ref={primaryRef}
              type="button"
              className="btn btn-lg btn-primary w-full"
              onClick={onRematch}
            >
              {isMultiplayer ? "Rematch" : "Play Again"}
            </button>
          )}
          <div className="flex gap-3">
            <button
              ref={onRematch ? undefined : primaryRef}
              type="button"
              className="btn btn-secondary flex-1 py-3"
              onClick={onNewGame}
            >
              New Game
            </button>
            {!isMultiplayer && (
              <button
                type="button"
                className="btn btn-secondary flex-1 py-3"
                onClick={handleShare}
              >
                {copied ? "Copied!" : "Share"}
              </button>
            )}
          </div>
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
    <div className="py-3">
      <div className="text-lg font-bold text-text-primary font-mono tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[0.6875rem] text-text-muted mt-1">{label}</div>
    </div>
  );
}
