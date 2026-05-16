import { cellKey, parsePuzzle } from "../sudoku.ts";
import { candidatesAt, peersOf } from "../sudoku-candidates.ts";
import type { CellCoord, CellOverlay, Demo, DemoStep } from "./types.ts";

function toKey(coord: CellCoord): number {
  return Array.isArray(coord)
    ? cellKey(coord[0], coord[1])
    : cellKey(coord.row, coord.col);
}

type StepDraft = {
  caption: string;
  overlays: Map<number, CellOverlay[]>;
  candidates?: Map<number, Set<number>>;
  holdMs?: number;
};

class DemoBuilder {
  private _puzzle: string = ".".repeat(81);
  private _currentStep: StepDraft | null = null;
  private _steps: DemoStep[] = [];
  private _runningCandidates: Map<number, Set<number>> | null = null;
  private _runningPlacements = new Map<number, number>();
  private _hasMutations = false;
  private _hasPlacements = false;
  private _restricts = new Map<number, Set<number>>();
  private readonly _id: string;
  private readonly _title: string;

  constructor(id: string, title: string) {
    this._id = id;
    this._title = title;
  }

  puzzle(puzzle: string): this {
    this._puzzle = puzzle;
    return this;
  }

  restrict(coord: CellCoord, digits: number[]): this {
    const key = toKey(coord);
    const set = new Set(digits);
    this._restricts.set(key, set);
    if (this._runningCandidates) {
      this._runningCandidates.set(key, new Set(set));
    }
    return this;
  }

  step(caption: string): this {
    this._finalizeStep();
    const draft: StepDraft = { caption, overlays: new Map() };
    if (this._hasMutations) {
      draft.candidates = this._snapshotCandidates();
    }
    this._currentStep = draft;
    return this;
  }

  focus(cells: CellCoord[]): this {
    return this._addOverlay(cells, { kind: "focus" });
  }

  place(row: number, col: number, value: number): this {
    const step = this._requireStep();
    this._initRunningIfNeeded();
    const key = cellKey(row, col);
    const overlays = step.overlays.get(key) ?? [];
    overlays.push({ kind: "solution", digits: [value] });
    step.overlays.set(key, overlays);
    this._runningPlacements.set(key, value);
    this._runningCandidates!.delete(key);
    for (const peer of peersOf(row, col)) {
      const peerKey = cellKey(peer.row, peer.col);
      this._runningCandidates!.get(peerKey)?.delete(value);
    }
    this._hasPlacements = true;
    this._hasMutations = true;
    return this;
  }

  eliminate(cells: CellCoord[], digits: number[]): this {
    const step = this._requireStep();
    this._initRunningIfNeeded();
    const normalized = [...digits];
    for (const coord of cells) {
      const key = toKey(coord);
      const overlays = step.overlays.get(key) ?? [];
      overlays.push({ kind: "eliminate", digits: normalized });
      step.overlays.set(key, overlays);
      const running = this._runningCandidates!.get(key);
      if (running) {
        for (const d of digits) running.delete(d);
      }
    }
    this._hasMutations = true;
    return this;
  }

  highlightRow(row: number): this {
    const cells: CellCoord[] = [];
    for (let c = 0; c < 9; c++) cells.push([row, c]);
    return this._addOverlay(cells, { kind: "unit" });
  }

  highlightCol(col: number): this {
    const cells: CellCoord[] = [];
    for (let r = 0; r < 9; r++) cells.push([r, col]);
    return this._addOverlay(cells, { kind: "unit" });
  }

  highlightBox(box: number): this {
    const boxRow = Math.floor(box / 3) * 3;
    const boxCol = (box % 3) * 3;
    const cells: CellCoord[] = [];
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        cells.push([r, c]);
      }
    }
    return this._addOverlay(cells, { kind: "unit" });
  }

  build(): Demo {
    this._finalizeStep();
    const board = parsePuzzle(this._puzzle);
    const initialCandidates = new Map<number, Set<number>>();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col]!.value === null) {
          initialCandidates.set(
            cellKey(row, col),
            candidatesAt(board, row, col),
          );
        }
      }
    }
    for (const [key, digits] of this._restricts) {
      initialCandidates.set(key, new Set(digits));
    }
    return {
      id: this._id,
      title: this._title,
      puzzle: this._puzzle,
      initialCandidates,
      steps: this._steps,
    };
  }

  private _addOverlay(cells: CellCoord[], overlay: CellOverlay): this {
    const step = this._requireStep();
    for (const coord of cells) {
      const key = toKey(coord);
      const list = step.overlays.get(key) ?? [];
      list.push(overlay);
      step.overlays.set(key, list);
    }
    return this;
  }

  private _requireStep(): StepDraft {
    if (!this._currentStep) {
      throw new Error("Call .step(caption) before adding overlays.");
    }
    return this._currentStep;
  }

  private _initRunningIfNeeded(): void {
    if (this._runningCandidates !== null) return;
    const board = parsePuzzle(this._puzzle);
    this._runningCandidates = new Map<number, Set<number>>();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col]!.value === null) {
          this._runningCandidates.set(
            cellKey(row, col),
            candidatesAt(board, row, col),
          );
        }
      }
    }
    for (const [key, digits] of this._restricts) {
      this._runningCandidates.set(key, new Set(digits));
    }
  }

  private _snapshotCandidates(): Map<number, Set<number>> {
    this._initRunningIfNeeded();
    const snapshot = new Map<number, Set<number>>();
    for (const [k, v] of this._runningCandidates!) {
      snapshot.set(k, new Set(v));
    }
    return snapshot;
  }

  private _snapshotPlacements(): Map<number, number> {
    return new Map(this._runningPlacements);
  }

  private _finalizeStep(): void {
    if (!this._currentStep) return;
    const finalized: DemoStep = {
      caption: this._currentStep.caption,
      overlays: this._currentStep.overlays,
    };
    if (this._currentStep.candidates) {
      finalized.candidates = this._currentStep.candidates;
    }
    if (this._hasPlacements) {
      finalized.placements = this._snapshotPlacements();
    }
    if (this._currentStep.holdMs !== undefined) {
      finalized.holdMs = this._currentStep.holdMs;
    }
    this._steps.push(finalized);
    this._currentStep = null;
  }
}

export function demo(id: string, title: string): DemoBuilder {
  return new DemoBuilder(id, title);
}
