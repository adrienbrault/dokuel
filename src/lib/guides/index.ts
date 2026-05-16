import { HIDDEN_PAIRS } from "./hidden-pairs.ts";
import { HIDDEN_SINGLES } from "./hidden-singles.ts";
import { NAKED_PAIRS } from "./naked-pairs.ts";
import { NAKED_SINGLES } from "./naked-singles.ts";
import { POINTING_PAIRS } from "./pointing-pairs.ts";
import { SCANNING } from "./scanning.ts";
import type { Guide } from "./types.ts";

export const GUIDES: Guide[] = [
  SCANNING,
  NAKED_SINGLES,
  HIDDEN_SINGLES,
  NAKED_PAIRS,
  HIDDEN_PAIRS,
  POINTING_PAIRS,
];

export function findGuide(id: string): Guide | null {
  return GUIDES.find((g) => g.id === id) ?? null;
}
