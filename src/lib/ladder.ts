/**
 * The ladder: every human solving technique the engine knows, ordered
 * cheapest first, each rung carrying the difficulty tier it marks, the
 * technique a hint names it by, and its display label. The grader, the
 * hint's unlock search and the hint banner all read this one list, so
 * a new technique joins the game by adding a rung and nothing else.
 *
 * Tiers:
 *   1 — naked/hidden singles (not a rung: singles place, they don't eliminate)
 *   2 — locked candidates, naked/hidden pairs
 *   3 — naked/hidden triples, X-wing
 *   4 — naked/hidden quads, XY-wing, swordfish
 *   5 — none of the above suffice: chains or trial-and-error required
 */

import type {
  CandidateState,
  Elimination,
  EliminationKind,
} from "./candidates.ts";
import type { HintTechnique } from "./types.ts";

export type TechniqueTier = 1 | 2 | 3 | 4 | 5;

export type Rung = {
  kind: EliminationKind;
  tier: TechniqueTier;
  technique: HintTechnique;
  label: string;
  scan: (s: CandidateState) => Elimination | null;
};

export const LADDER: readonly Rung[] = [];
