import { useCallback, useMemo, useState } from "react";
import { getDailyPuzzle } from "../lib/daily.ts";
import { formatShortDate } from "../lib/format.ts";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import type { TechniqueId } from "../lib/guides/types.ts";
import { SoloGame } from "./SoloGame.tsx";

type DailyGameProps = {
  onBack: () => void;
  onOpenGuide?: ((id: TechniqueId) => void) | undefined;
};

export function DailyGame({ onBack, onOpenGuide }: DailyGameProps) {
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { puzzle } = useMemo(() => getDailyPuzzle(date, "medium"), [date]);
  const [streakInfo, setStreakInfo] = useState<{
    currentStreak: number;
    longestStreak: number;
  }>();

  const handleComplete = useCallback(
    (_time: number, result: GameCompletionResult) => {
      if (result.streak) {
        setStreakInfo({
          currentStreak: result.streak.currentStreak,
          longestStreak: result.streak.longestStreak,
        });
      }
    },
    [],
  );

  return (
    <SoloGame
      difficulty="medium"
      gameKey={`daily-${date}-medium`}
      initialPuzzle={puzzle}
      dailyDate={date}
      title={`Daily Challenge — ${formatShortDate(date)}`}
      onBack={onBack}
      onComplete={handleComplete}
      streakInfo={streakInfo}
      onOpenGuide={onOpenGuide}
    />
  );
}
