import { useCallback, useEffect, useMemo, useState } from "react";
import { getDailyPuzzleFor } from "../lib/daily.ts";
import { todayLocalISO } from "../lib/date.ts";
import { formatShortDate } from "../lib/format.ts";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import { SoloGame } from "./SoloGame.tsx";

export function DailyGame({ onBack }: { onBack: () => void }) {
  const date = useMemo(() => todayLocalISO(), []);
  const [puzzle, setPuzzle] = useState<string | null>(null);
  const [streakInfo, setStreakInfo] = useState<{
    currentStreak: number;
    longestStreak: number;
  }>();

  // The frozen board table is a dynamic import (its own chunk), so the
  // puzzle arrives a tick after mount.
  useEffect(() => {
    let cancelled = false;
    void getDailyPuzzleFor(date).then((daily) => {
      if (!cancelled) setPuzzle(daily.puzzle);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

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

  if (puzzle === null) {
    return (
      <div className="screen">
        <p className="caption">Loading the daily...</p>
      </div>
    );
  }

  return (
    <SoloGame
      difficulty="medium"
      gameKey={`daily-${date}-medium`}
      initialPuzzle={puzzle}
      dailyDate={date}
      title={`Daily Challenge - ${formatShortDate(date)}`}
      isDaily={true}
      onBack={onBack}
      onComplete={handleComplete}
      streakInfo={streakInfo}
    />
  );
}
