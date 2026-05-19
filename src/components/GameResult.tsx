import { Flame, Share2, Zap } from "lucide-react";
import { useState } from "react";
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
      <div className="modal-panel gap-5 max-w-sm sm:max-w-md w-full relative">
        <div className="flex flex-col items-center gap-2">
          <span className="text-6xl animate-emoji-bounce">
            {isWinner ? "🎉" : "👏"}
          </span>
          <h2 className="heading text-3xl">
            {isWinner ? "You Won!" : "Puzzle Complete!"}
          </h2>
          {difficulty && (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${DIFFICULTY_BADGE_CLASSES[difficulty]}`}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full rounded-2xl bg-bg-inset border border-border-default py-4">
          <span className="text-4xl font-mono font-extrabold tabular-nums text-text-primary">
            {time}
          </span>
          {isNewPB && !isMultiplayer && (
            <span className="flex items-center gap-1 text-sm font-bold text-accent">
              <Zap size={14} fill="currentColor" aria-hidden="true" />
              New Personal Best!
            </span>
          )}
        </div>

        {stats && !isMultiplayer && (
          <div className="grid grid-cols-3 gap-2 w-full text-center">
            <ResultStat value={`${stats.gamesPlayed}`} label="Played" />
            <ResultStat value={formatTime(stats.bestTime)} label="Best" />
            <ResultStat value={formatTime(stats.averageTime)} label="Average" />
          </div>
        )}

        {streakInfo && streakInfo.currentStreak > 0 && (
          <div className="flex items-center justify-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-400">
            <Flame size={14} fill="currentColor" aria-hidden="true" />
            <span>{streakInfo.currentStreak}-day streak!</span>
            {streakInfo.currentStreak >= streakInfo.longestStreak &&
              streakInfo.currentStreak > 1 && (
                <span className="text-xs font-medium opacity-80">
                  New record!
                </span>
              )}
          </div>
        )}

        <div className="flex flex-col gap-2.5 w-full">
          {onRematch && (
            <button
              type="button"
              className="btn btn-primary w-full py-3.5 text-lg"
              onClick={onRematch}
            >
              {isMultiplayer ? "Rematch" : "Play Again"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary w-full py-3.5 text-lg"
            onClick={onNewGame}
          >
            New Game
          </button>
          {!isMultiplayer && (
            <button
              type="button"
              className="btn btn-ghost w-full py-2 flex items-center justify-center gap-1.5"
              onClick={handleShare}
            >
              <Share2 size={15} aria-hidden="true" />
              {copied ? "Copied!" : "Share Result"}
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

function ResultStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-bg-raised py-2.5">
      <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
