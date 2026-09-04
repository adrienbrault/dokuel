import { useEffect, useRef } from "react";
import type { compareChallenge, FriendChallenge } from "../lib/challenge.ts";
import {
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
} from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import type { Difficulty } from "../lib/types.ts";

import {
  MultiplayerResultComparison,
  type MultiplayerResultComparisonProps,
} from "./MultiplayerResultComparison.tsx";
import { ResultShare } from "./ResultShare.tsx";

type GameResultProps = {
  shareChallenge?: FriendChallenge | undefined;
  comparison?: ReturnType<typeof compareChallenge> | undefined;
  isWinner: boolean;
  time: string;
  timeSeconds?: number | undefined;
  difficulty?: Difficulty | undefined;
  isMultiplayer?: boolean | undefined;
  multiplayerResults?: MultiplayerResultComparisonProps | undefined;
  rematchState?: "requested" | "offered" | undefined;
  onRematch?: (() => void) | undefined;
  onNewGame: () => void;
  stats?: {
    gamesPlayed: number;
    bestTime: number | null;
    averageTime: number;
  } | null;
  isNewPB?: boolean | undefined;
  hintsUsed?: number | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
  isDaily?: boolean | undefined;
  tip?: string | undefined;
  onDismissTip?: (() => void) | undefined;
};

export function GameResult({
  isWinner,
  comparison,
  shareChallenge,
  time,
  difficulty,
  isMultiplayer,
  multiplayerResults,
  onRematch,
  rematchState,
  onNewGame,
  stats,
  isNewPB,
  hintsUsed,
  streakInfo,
  isDaily,
  tip,
  onDismissTip,
}: GameResultProps) {
  // Modal focus management: move focus onto the primary action when the
  // result opens (this is also what makes screen readers announce the
  // outcome), restore it when the dialog goes away, and keep Tab
  // cycling inside — without this, Tab walked the covered board.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const primary = panelRef.current?.querySelector<HTMLElement>(
      "button:not(:disabled)",
    );
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
      panel.querySelectorAll<HTMLElement>(
        "button, input, textarea, [href], [tabindex]",
      ),
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

  return (
    <div className="modal-overlay p-3 sm:p-6">
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
        className="modal-panel gap-5 short:gap-3 max-w-sm sm:max-w-md w-full relative"
      >
        <div className="flex flex-col items-center gap-2.5">
          <span
            className={`flex items-center justify-center w-16 h-16 short:w-10 short:h-10 shrink-0 rounded-full text-4xl short:text-2xl animate-emoji-bounce ${
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

        {isMultiplayer && multiplayerResults && (
          <MultiplayerResultComparison {...multiplayerResults} />
        )}

        {comparison && (
          <p
            role="status"
            className="text-center text-sm font-semibold text-accent"
          >
            {comparison.outcome === "beat"
              ? `You beat the target by ${formatTime(comparison.seconds)}!`
              : comparison.outcome === "matched"
                ? "You matched the target!"
                : comparison.outcome === "extra-help"
                  ? "Puzzle complete with extra help — practice result."
                  : `Puzzle complete — ${formatTime(comparison.seconds)} after the target.`}
          </p>
        )}
        {stats && !isMultiplayer && (
          <div className="grid grid-cols-3 gap-2.5 w-full text-center">
            <StatTile label="Played" value={String(stats.gamesPlayed)} />
            <StatTile
              label="Best"
              value={stats.bestTime === null ? "—" : formatTime(stats.bestTime)}
            />
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
          {!isMultiplayer && (
            <ResultShare
              difficulty={difficulty}
              time={time}
              isNewPB={isNewPB}
              hintsUsed={hintsUsed}
              streakInfo={streakInfo}
              isDaily={isDaily}
              shareChallenge={shareChallenge}
            />
          )}

          {onRematch && (
            <button
              type="button"
              className={`btn ${shareChallenge ? "btn-secondary" : "btn-primary"} w-full py-3 text-lg`}
              onClick={onRematch}
              disabled={rematchState === "requested"}
            >
              {isMultiplayer
                ? rematchState === "requested"
                  ? "Rematch requested"
                  : rematchState === "offered"
                    ? "Accept rematch"
                    : "Rematch"
                : difficulty
                  ? `New ${DIFFICULTY_LABELS[difficulty]} puzzle`
                  : "Another puzzle"}
            </button>
          )}
          {rematchState === "requested" && (
            <p role="status" className="caption text-center">
              Waiting for your opponent to accept.
            </p>
          )}
          <button
            type="button"
            className="btn btn-secondary w-full py-3 text-lg"
            onClick={onNewGame}
          >
            {isMultiplayer ? "Leave room" : "Back to home"}
          </button>
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
