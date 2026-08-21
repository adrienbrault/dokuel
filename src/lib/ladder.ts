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

import {
  type CandidateState,
  cloneCandidates,
  type Elimination,
  type EliminationKind,
  findSingle,
  type SingleFind,
} from "./candidates.ts";
import { claiming, hiddenSet, nakedSet, pointing } from "./techniques.ts";
import type { HintTechnique } from "./types.ts";
import { swordfish, xWing, xyWing } from "./wings.ts";

export type TechniqueTier = 1 | 2 | 3 | 4 | 5;

export type Rung = {
  kind: EliminationKind;
  tier: TechniqueTier;
  technique: HintTechnique;
  label: string;
  scan: (s: CandidateState) => Elimination | null;
};

// Pointing and claiming are one technique to a player — locked
// candidates — so they share a label and differ only in which house
// does the locking.
export const LADDER: readonly Rung[] = [
  {
    kind: "pointing",
    tier: 2,
    technique: "locked-candidates",
    label: "Locked Candidates",
    scan: pointing,
  },
  {
    kind: "claiming",
    tier: 2,
    technique: "locked-candidates",
    label: "Locked Candidates",
    scan: claiming,
  },
  {
    kind: "naked-pair",
    tier: 2,
    technique: "naked-pair",
    label: "Naked Pair",
    scan: (s) => nakedSet(s, 2),
  },
  {
    kind: "hidden-pair",
    tier: 2,
    technique: "hidden-pair",
    label: "Hidden Pair",
    scan: (s) => hiddenSet(s, 2),
  },
  {
    kind: "naked-triple",
    tier: 3,
    technique: "naked-triple",
    label: "Naked Triple",
    scan: (s) => nakedSet(s, 3),
  },
  {
    kind: "hidden-triple",
    tier: 3,
    technique: "hidden-triple",
    label: "Hidden Triple",
    scan: (s) => hiddenSet(s, 3),
  },
  {
    kind: "x-wing",
    tier: 3,
    technique: "x-wing",
    label: "X-Wing",
    scan: xWing,
  },
  {
    kind: "naked-quad",
    tier: 4,
    technique: "naked-quad",
    label: "Naked Quad",
    scan: (s) => nakedSet(s, 4),
  },
  {
    kind: "hidden-quad",
    tier: 4,
    technique: "hidden-quad",
    label: "Hidden Quad",
    scan: (s) => hiddenSet(s, 4),
  },
  {
    kind: "xy-wing",
    tier: 4,
    technique: "xy-wing",
    label: "XY-Wing",
    scan: xyWing,
  },
  {
    kind: "swordfish",
    tier: 4,
    technique: "swordfish",
    label: "Swordfish",
    scan: swordfish,
  },
];

export type UnlockingPlacement = {
  /** The elimination whose removals make the placement visible. */
  elimination: Elimination;
  /** The single that emerges once the elimination is applied. */
  single: SingleFind;
  /** Eliminations silently applied before the unlocking one. */
  priorSteps: number;
};

/**
 * On a board whose singles have run dry, find the elimination that
 * makes the next placement visible. Prefers an elimination that
 * unlocks a single immediately — its explanation stands on the visible
 * board alone. When no technique unlocks anything directly, cheaper
 * eliminations are applied silently and the search repeats; priorSteps
 * counts them so a hint can be honest about the depth. Null when only
 * chains or guessing can progress.
 *
 * The caller must have scanned for singles already — it explains those
 * itself, in richer words — and keeps its own state: the search walks
 * a copy, so the eliminations it applies never reach the caller's.
 */
export function findUnlockingPlacement(
  state: CandidateState,
): UnlockingPlacement | null {
  const s = cloneCandidates(state);
  // Eliminations strictly shrink the candidate pool, so the walk
  // terminates; the cap is a backstop, not a tuning knob.
  for (let priorSteps = 0; priorSteps < 128; priorSteps++) {
    for (const rung of LADDER) {
      const preview = cloneCandidates(s);
      const elimination = rung.scan(preview);
      if (!elimination) continue;
      const single = findSingle(preview);
      if (single) return { elimination, single, priorSteps };
    }
    let applied: Elimination | null = null;
    for (const rung of LADDER) {
      applied = rung.scan(s);
      if (applied) break;
    }
    if (!applied) return null;
  }
  return null;
}

const RUNG_BY_KIND = new Map<EliminationKind, Rung>(
  LADDER.map((rung) => [rung.kind, rung]),
);

/**
 * The rung an elimination kind sits on — how a hint learns which
 * technique to name it by. Total by construction: ladder.test.ts pins
 * that every kind appears on exactly one rung.
 */
export function rungOf(kind: EliminationKind): Rung {
  return RUNG_BY_KIND.get(kind)!;
}

/**
 * Techniques a hint reports that are not rungs: singles place a digit
 * rather than eliminating candidates, and the mistake redirect and
 * reveal fallback are not deductions at all.
 */
const OFF_LADDER_LABELS: Partial<Record<HintTechnique, string>> = {
  "naked-single": "Naked Single",
  "hidden-single": "Hidden Single",
  mistake: "Mistake",
  reveal: "Reveal",
};

/** The player-facing name of a technique, for the hint banner. */
export function techniqueLabel(technique: HintTechnique): string {
  const rung = LADDER.find((candidate) => candidate.technique === technique);
  return rung?.label ?? OFF_LADDER_LABELS[technique] ?? technique;
}
