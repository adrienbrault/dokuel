import { useState } from "react";
import {
  DIFFICULTY_BADGE_CLASSES,
  DIFFICULTY_LABELS,
} from "../lib/constants.ts";
import { formatTime } from "../lib/format.ts";
import type { Difficulty } from "../lib/types.ts";
import { Button } from "./ui/button.tsx";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.tsx";

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

  const title = isWinner ? "You Won!" : "Puzzle Complete!";
  return (
    <>
      {isWinner && <ConfettiOverlay />}
      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="flex flex-col items-center gap-5 max-w-sm sm:max-w-md"
        >
          <div className="flex flex-col items-center gap-2.5">
            <span
              className={`flex items-center justify-center w-16 h-16 rounded-full text-4xl animate-emoji-bounce ${
                isWinner ? "bg-accent-light" : "bg-bg-inset"
              }`}
            >
              {isWinner ? "🎉" : "👏"}
            </span>
            <DialogTitle className="heading">{title}</DialogTitle>
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
              <Button size="lg" className="w-full" onClick={onRematch}>
                {isMultiplayer ? "Rematch" : "Play Again"}
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={onNewGame}
            >
              New Game
            </Button>
            {!isMultiplayer && (
              <Button variant="ghost" className="w-full" onClick={handleShare}>
                {copied ? "Copied!" : "Share Result"}
              </Button>
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
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConfettiOverlay() {
  return (
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
