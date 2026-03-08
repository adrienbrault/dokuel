import { useCallback, useMemo, useState } from "react";
import { getDailyPuzzle } from "../lib/daily.ts";
import { recordDailyCompletion } from "../lib/daily-streak.ts";
import { formatShortDate } from "../lib/format.ts";
import { SoloGame } from "./SoloGame.tsx";

export function DailyGame({ onBack }: { onBack: () => void }) {
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { puzzle } = useMemo(() => getDailyPuzzle(date, "medium"), [date]);
  const [streakInfo, setStreakInfo] = useState<{
    currentStreak: number;
    longestStreak: number;
  }>();
  const handleComplete = useCallback(() => {
    const streak = recordDailyCompletion(date);
    setStreakInfo({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    });
  }, [date]);

  return (
    <SoloGame
      difficulty="medium"
      gameKey={`daily-${date}-medium`}
      initialPuzzle={puzzle}
      title={`Daily Challenge — ${formatShortDate(date)}`}
      onBack={onBack}
      onComplete={handleComplete}
      streakInfo={streakInfo}
    />
  );
}
