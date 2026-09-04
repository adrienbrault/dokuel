import { findHint } from "./hint-engine.ts";
import { parsePuzzle, solvePuzzle } from "./sudoku.ts";
import type { HintTechnique, Position } from "./types.ts";

/** Techniques for which a player can practise a concrete deduction. */
export const PRACTICE_TECHNIQUES = [
  "naked-single",
  "hidden-single",
  "locked-candidates",
  "naked-pair",
  "hidden-pair",
  "naked-triple",
  "hidden-triple",
  "naked-quad",
  "hidden-quad",
  "x-wing",
  "xy-wing",
  "swordfish",
] as const;

export type PracticeTechnique = (typeof PRACTICE_TECHNIQUES)[number];

export type LearningExerciseData = {
  technique: PracticeTechnique;
  puzzle: string;
  solution: string;
  position: Position;
  answer: number;
  prompt: string;
};

type Fixture = {
  puzzle: string;
};

// These are board positions captured immediately before a clear deduction.
// Keeping a small, curated set makes a follow-up exercise instant and
// deterministic while still giving the player a different board from the
// game that produced the hint.
const FIXTURES: Record<PracticeTechnique, readonly Fixture[]> = {
  "naked-single": [
    {
      puzzle:
        "41..68.2.6..72.145.5..3...78.527.....42953.7...3..459..2...57.3....9.2......4.956",
    },
  ],
  "hidden-single": [
    {
      puzzle:
        "7.8..4.6....7.5..865...2..438....257...3..4.157...1....6.....1.43.21.9..81.......",
    },
  ],
  "locked-candidates": [
    {
      puzzle:
        ".3..8..62.2...6.3..962..81.647129358389754621512368.9..5.672.4.9648..27.27.49..86",
    },
  ],
  "naked-pair": [
    {
      puzzle:
        ".9.7135....58421791..659.4.8...6.952..932581425.98....9...76...5..23.691.26.9....",
    },
  ],
  "hidden-pair": [
    {
      puzzle:
        "......89...7......5..46.7.12746..519831925.7.9651742831......4834..129.77.9.461.2",
    },
  ],
  "naked-triple": [
    {
      puzzle:
        ".8....1..1..2....8.37..8.6.41.589....95..1.8.8...3.519..8..639.9613..8.....895671",
    },
  ],
  "hidden-triple": [
    {
      puzzle:
        "....5..4.......1.6.8...3.7589.4.57..15..97..44.71..5...482..6..9.....43..1....8.2",
    },
  ],
  "naked-quad": [
    {
      puzzle:
        "6.4..8..72..59184689...63.....8.267...8.57..972.9..518.82..5...5........1....97.5",
    },
  ],
  "hidden-quad": [
    {
      puzzle:
        ".......797.493....6....7.13...4....7....5.3.1..572.9...2.3....8.8.172.3....5.8..2",
    },
  ],
  "x-wing": [
    {
      puzzle:
        "49.7135....58421791..659.4.8...67952..932581425.98....9...76...5..23.691.26.9....",
    },
  ],
  "xy-wing": [
    {
      puzzle:
        "..8693451391854762564721..3....78..9.52.49.....9.6.....4.9.6.789..4871....7.....4",
    },
  ],
  swordfish: [
    {
      puzzle:
        "....1..3519.3.........64...4.65..1......9...89..1..25....7.856.5.8............48.",
    },
  ],
};

// Digit renaming preserves every logical relationship on a board. These
// variants keep a focused exercise available even when the current game is
// itself one of the curated fixtures.
const DIGIT_SWAPS: readonly [number, number][] = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
];

const TECHNIQUE_LABELS: Record<PracticeTechnique, string> = {
  "naked-single": "naked single",
  "hidden-single": "hidden single",
  "locked-candidates": "locked candidates",
  "naked-pair": "naked pair",
  "hidden-pair": "hidden pair",
  "naked-triple": "naked triple",
  "hidden-triple": "hidden triple",
  "naked-quad": "naked quad",
  "hidden-quad": "hidden quad",
  "x-wing": "X-wing",
  "xy-wing": "XY-wing",
  swordfish: "swordfish",
};

function isPracticeTechnique(
  technique: HintTechnique,
): technique is PracticeTechnique {
  return (PRACTICE_TECHNIQUES as readonly HintTechnique[]).includes(technique);
}

function cellName(position: Position): string {
  return `row ${position.row + 1}, column ${position.col + 1}`;
}

/** Whether the hint can be turned into a concrete follow-up exercise. */
export function canPractiseTechnique(
  technique: HintTechnique,
): technique is PracticeTechnique {
  return isPracticeTechnique(technique);
}

/**
 * Select a curated board whose first available hint teaches the requested
 * technique. The source puzzle is excluded so a practice session cannot ask
 * the player to repeat the answer they just saw.
 */
export function createLearningExercise(
  technique: HintTechnique,
  sourcePuzzle?: string | undefined,
): LearningExerciseData | null {
  if (!isPracticeTechnique(technique)) return null;
  for (const fixture of FIXTURES[technique]) {
    const variants = [
      fixture.puzzle,
      ...DIGIT_SWAPS.map((swap) => remapDigits(fixture.puzzle, swap)),
    ];
    for (const puzzle of variants) {
      if (puzzle === sourcePuzzle) continue;
      const solution = solvePuzzle(puzzle);
      if (!solution) continue;
      const hint = findHint(parsePuzzle(puzzle), solution);
      if (!hint || hint.technique !== technique) continue;
      return {
        technique,
        puzzle,
        solution,
        position: hint.position,
        answer: hint.value,
        prompt: `On this new board, use the ${TECHNIQUE_LABELS[technique]} pattern at ${cellName(hint.position)}. Which digit follows?`,
      };
    }
  }
  return null;
}

function remapDigits(puzzle: string, swap: readonly [number, number]): string {
  const [first, second] = swap;
  return Array.from(puzzle, (value) => {
    if (value === String(first)) return String(second);
    if (value === String(second)) return String(first);
    return value;
  }).join("");
}
