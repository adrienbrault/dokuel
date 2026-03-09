import { formatTime } from "../lib/format.ts";
import { getImprovementDelta, getRecentTimes } from "../lib/stats.ts";
import type { Difficulty } from "../lib/types.ts";
import { GameResult } from "./GameResult.tsx";

export function SoloGameResult({
  timeSeconds,
  difficulty,
  onBack,
  onRematch,
  priorStats,
  personalBest,
  hintsUsed,
  streakInfo,
  isDaily,
  position,
  tipDismissed,
  onDismissTip,
}: {
  timeSeconds: number;
  difficulty: Difficulty;
  onBack: () => void;
  onRematch?: (() => void) | undefined;
  priorStats: {
    gamesPlayed: number;
    bestTime: number;
    averageTime: number;
  } | null;
  personalBest: number | null;
  hintsUsed: number;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
  isDaily: boolean;
  position: string;
  tipDismissed: boolean;
  onDismissTip: () => void;
}) {
  return (
    <GameResult
      isWinner={true}
      time={formatTime(timeSeconds)}
      timeSeconds={timeSeconds}
      difficulty={difficulty}
      onNewGame={onBack}
      onRematch={onRematch}
      stats={
        priorStats ?? {
          gamesPlayed: 0,
          bestTime: timeSeconds,
          averageTime: timeSeconds,
        }
      }
      isNewPB={
        hintsUsed === 0 && (personalBest === null || timeSeconds < personalBest)
      }
      hintsUsed={hintsUsed}
      recentTimes={getRecentTimes(difficulty)}
      improvementDelta={getImprovementDelta(difficulty)}
      streakInfo={streakInfo}
      isDaily={isDaily}
      tip={
        !tipDismissed && position === "bottom"
          ? "Tip: Move the numpad to the side for faster two-finger play! Tap the pad icon to try it."
          : undefined
      }
      onDismissTip={onDismissTip}
    />
  );
}
