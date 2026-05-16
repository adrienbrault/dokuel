import { CLAIMING } from "./claiming.ts";
import { HIDDEN_PAIRS } from "./hidden-pairs.ts";
import { HIDDEN_SINGLES } from "./hidden-singles.ts";
import { HIDDEN_TRIPLES } from "./hidden-triples.ts";
import { JELLYFISH } from "./jellyfish.ts";
import { NAKED_PAIRS } from "./naked-pairs.ts";
import { NAKED_SINGLES } from "./naked-singles.ts";
import { NAKED_TRIPLES } from "./naked-triples.ts";
import { POINTING_PAIRS } from "./pointing-pairs.ts";
import { SCANNING } from "./scanning.ts";
import { SWORDFISH } from "./swordfish.ts";
import type { Guide } from "./types.ts";
import { X_WING } from "./x-wing.ts";
import { Y_WING } from "./y-wing.ts";

export const GUIDES: Guide[] = [
  SCANNING,
  NAKED_SINGLES,
  HIDDEN_SINGLES,
  NAKED_PAIRS,
  HIDDEN_PAIRS,
  NAKED_TRIPLES,
  HIDDEN_TRIPLES,
  POINTING_PAIRS,
  CLAIMING,
  X_WING,
  SWORDFISH,
  JELLYFISH,
  Y_WING,
];

export function findGuide(id: string): Guide | null {
  return GUIDES.find((g) => g.id === id) ?? null;
}
