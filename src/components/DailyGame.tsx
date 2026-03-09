import { useCallback, useMemo, useState } from "react";
import { getDailyPuzzle } from "../lib/daily.ts";
import {
  recordDailyCompletion,
  saveDailyResult,
} from "../lib/daily-streak.ts";
import { formatShortDate, getTodayISO } from "../lib/format.ts";
import { SoloGame } from "./SoloGame.tsx";

export function DailyGame({ onBack }: { onBack: () => void }) {
  const date = useMemo(() => getTodayISO(), []);
  const { puzzle } = useMemo(() => getDailyPuzzle(date, "medium"), [date]);
  const [streakInfo, setStreakInfo] = useState<{
    currentStreak: number;
    longestStreak: number;
  }>();
  const handleComplete = useCallback(
    (time: number) => {
      const streak = recordDailyCompletion(date);
      saveDailyResult(date, time);
      setStreakInfo({
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
      });
    },
    [date],
  );

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
