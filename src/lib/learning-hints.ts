import type { ActiveHint, HintStep, HintTechnique, Position } from "./types.ts";

export const HINT_STEPS: readonly HintStep[] = [
  "nudge",
  "pattern",
  "elimination",
  "reveal",
];

const TECHNIQUE_LABELS: Record<HintTechnique, string> = {
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
  mistake: "mistake",
  reveal: "reveal",
};

function cellName(position: Position): string {
  return `row ${position.row + 1}, column ${position.col + 1}`;
}

function stepIndex(step: HintStep | undefined): number {
  return step === undefined ? -1 : HINT_STEPS.indexOf(step);
}

export function nextHintStep(step: HintStep | undefined): HintStep {
  return HINT_STEPS[Math.min(stepIndex(step) + 1, HINT_STEPS.length - 1)]!;
}

function nudgeText(hint: ActiveHint): string {
  const cell = cellName(hint.position);
  if (hint.technique === "mistake") {
    return `Start with the entry at ${cell}. Check it against its row, column, and box before making another deduction.`;
  }
  if (hint.technique === "reveal") {
    return "Look for a useful deduction in the rows, columns, and boxes before asking for the answer.";
  }
  return `Start at ${cell}. Look across its row, column, and box for the digits that are already ruled out.`;
}

function patternText(hint: ActiveHint): string {
  const cell = cellName(hint.position);
  switch (hint.technique) {
    case "naked-single":
      return `Study ${cell}: its filled peers leave one open candidate.`;
    case "hidden-single":
      return `Scan the highlighted house around ${cell} for the digit that has only one possible place.`;
    case "mistake":
      return `Inspect ${cell} and the peers that depend on it; one entry is breaking the deduction.`;
    case "reveal":
      return `No direct ${TECHNIQUE_LABELS[hint.technique]} pattern is available here. Keep the highlighted cell in mind while you narrow the board.`;
    default:
      return `Look for the highlighted ${TECHNIQUE_LABELS[hint.technique]} pattern around ${cell}.`;
  }
}

function eliminationText(hint: ActiveHint): string {
  const cell = cellName(hint.position);
  if (hint.technique === "naked-single") {
    return `Cross out the digits used by the peers of ${cell}; one candidate remains.`;
  }
  if (hint.technique === "hidden-single") {
    return `In the highlighted house, this digit has no other legal cell besides ${cell}; the other empty cells rule it out in their rows, columns, or boxes.`;
  }
  const earlier =
    hint.intermediateSteps && hint.intermediateSteps.length > 0
      ? `Earlier deductions: ${hint.intermediateSteps.join(" ")} `
      : "";
  if (hint.eliminationOnly) {
    return `${earlier}${hint.explanation} Apply that elimination to continue.`;
  }
  return `${earlier}Apply the highlighted ${TECHNIQUE_LABELS[hint.technique]} elimination. Cross out only the candidates that pattern rules out.`;
}

function revealText(hint: ActiveHint): string {
  const cell = cellName(hint.position);
  if (hint.technique === "mistake") return hint.explanation;
  if (hint.eliminationOnly) {
    return `${hint.explanation} Apply that elimination to continue.`;
  }
  return `${hint.explanation} Enter ${hint.value} in ${cell}.`;
}

/** Present one engine hint at a teaching stage without changing the board. */
export function presentHint(hint: ActiveHint, step: HintStep): ActiveHint {
  const relatedCells = step === "nudge" ? [] : hint.relatedCells;
  const explanation =
    step === "nudge"
      ? nudgeText(hint)
      : step === "pattern"
        ? patternText(hint)
        : step === "elimination"
          ? eliminationText(hint)
          : revealText(hint);
  return { ...hint, explanation, relatedCells, step };
}
