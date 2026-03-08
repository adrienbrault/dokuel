import { useState } from "react";
import { formatTime } from "../lib/format.ts";
import type { Difficulty } from "../lib/types.ts";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-difficulty-easy-bg text-difficulty-easy-text",
  medium: "bg-difficulty-medium-bg text-difficulty-medium-text",
  hard: "bg-difficulty-hard-bg text-difficulty-hard-text",
  expert: "bg-difficulty-expert-bg text-difficulty-expert-text",
};

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
  difficulty?: Difficulty;
  time: string;
  isNewPB?: boolean;
  hintsUsed?: number;
  streakInfo?: { currentStreak: number; longestStreak: number };
  isDaily?: boolean;
}): string {
  const title = isDaily ? "Dokuel Daily" : "Dokuel";
  const diffLabel = difficulty ? ` ${DIFFICULTY_LABELS[difficulty]}` : "";
  const hints = hintsUsed ? ` · ${hintsUsed} hint${hintsUsed > 1 ? "s" : ""}` : "";
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
          <span className="text-5xl animate-emoji-bounce">
            {isWinner ? "🎉" : "👏"}
          </span>
          <h2 className="heading">
            {isWinner ? "You Won!" : "Puzzle Complete!"}
          </h2>
          {difficulty && (
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[difficulty]}`}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-mono font-bold tabular-nums text-text-primary">
            {time}
          </span>
          {isNewPB && !isMultiplayer && (
            <span className="text-sm font-semibold text-accent">
              New Personal Best!
            </span>
          )}
        </div>

        {stats && !isMultiplayer && (
          <div className="grid grid-cols-3 gap-4 w-full text-center">
            <div>
              <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {stats.gamesPlayed}
              </div>
              <div className="text-xs text-text-muted">Played</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {formatTime(stats.bestTime)}
              </div>
              <div className="text-xs text-text-muted">Best</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {formatTime(stats.averageTime)}
              </div>
              <div className="text-xs text-text-muted">Average</div>
            </div>
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
            <button
              type="button"
              className="btn btn-ghost w-full py-2"
              onClick={handleShare}
            >
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
