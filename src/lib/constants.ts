import type { AssistLevel, Difficulty } from "./types.ts";

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const DIFFICULTIES: readonly Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
] as const;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export const DIFFICULTY_BADGE_CLASSES: Record<Difficulty, string> = {
  easy: "bg-difficulty-easy-bg text-difficulty-easy-text",
  medium: "bg-difficulty-medium-bg text-difficulty-medium-text",
  hard: "bg-difficulty-hard-bg text-difficulty-hard-text",
  expert: "bg-difficulty-expert-bg text-difficulty-expert-text",
};

export const DIFFICULTY_TEXT_COLORS: Record<Difficulty, string> = {
  easy: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  hard: "text-orange-600 dark:text-orange-400",
  expert: "text-rose-600 dark:text-rose-400",
};

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] =
  DIFFICULTIES.map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

export const ASSIST_LEVEL_LABELS: Record<AssistLevel, string> = {
  paper: "Paper",
  standard: "Standard",
  full: "Full",
};
