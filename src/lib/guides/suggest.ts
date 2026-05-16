import type { Difficulty } from "../types.ts";
import type { Guide, Level, TechniqueId } from "./types.ts";

const DIFFICULTY_TIER: Record<Difficulty, Level> = {
  easy: "beginner",
  medium: "beginner",
  hard: "intermediate",
  expert: "advanced",
};

export type SuggestOptions = {
  difficulty?: Difficulty;
  hintsUsed?: number;
  viewed: Set<TechniqueId>;
};

const FOUNDATIONAL: TechniqueId[] = ["naked-singles", "hidden-singles"];

export function suggestGuide(
  guides: Guide[],
  opts: SuggestOptions,
): Guide | null {
  const unviewed = guides.filter((g) => !opts.viewed.has(g.id));
  if (unviewed.length === 0) return null;

  if ((opts.hintsUsed ?? 0) > 2) {
    const foundational = unviewed.find((g) => FOUNDATIONAL.includes(g.id));
    if (foundational) return foundational;
  }

  const tier: Level = opts.difficulty
    ? DIFFICULTY_TIER[opts.difficulty]
    : "beginner";
  const inTier = unviewed.find((g) => g.level === tier);
  if (inTier) return inTier;

  return unviewed[0] ?? null;
}
