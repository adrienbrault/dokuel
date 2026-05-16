import { useEffect, useMemo, useState } from "react";
import type { Challenge, ChallengeQuestion } from "../../lib/guides/types.ts";
import { cellKey, parsePuzzle } from "../../lib/sudoku.ts";
import type { Board as BoardType } from "../../lib/types.ts";
import { Board } from "../Board.tsx";

const EMPTY_CONFLICTS = new Set<number>();

type ChallengePanelProps = {
  challenges: Challenge[];
};

type Verdict = { correct: boolean } | null;

export function ChallengePanel({ challenges }: ChallengePanelProps) {
  const [variantIndex, setVariantIndex] = useState(0);
  const current = challenges[variantIndex % challenges.length]!;
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [picks, setPicks] = useState<{
    cells: Set<number>;
    digits: Set<number>;
  }>(() => ({ cells: new Set(), digits: new Set() }));

  useEffect(() => {
    setVerdict(null);
    setPicks({ cells: new Set(), digits: new Set() });
  }, [variantIndex]);

  const board = useMemo<BoardType>(() => {
    const b = parsePuzzle(current.puzzle);
    for (const [key, digits] of current.initialCandidates) {
      const row = Math.floor(key / 9);
      const col = key % 9;
      const cell = b[row]![col]!;
      if (cell.value === null) cell.notes = new Set(digits);
    }
    return b;
  }, [current]);

  const targetCellKey = useMemo(() => {
    const q = current.question;
    if (q.kind === "place" || q.kind === "eliminate") {
      return cellKey(q.cell.row, q.cell.col);
    }
    return null;
  }, [current]);

  const handleCheck = (q: ChallengeQuestion) => {
    setVerdict({ correct: evaluate(q, picks) });
  };

  const handlePickDigit = (digit: number) => {
    if (verdict) return;
    const q = current.question;
    if (q.kind === "place") {
      // Single-digit, immediate submit
      setPicks({ cells: new Set(), digits: new Set([digit]) });
      setVerdict({ correct: digit === q.value });
      return;
    }
    if (q.kind === "eliminate") {
      const next = new Set(picks.digits);
      if (next.has(digit)) next.delete(digit);
      else next.add(digit);
      setPicks({ cells: picks.cells, digits: next });
    }
  };

  const handleTapCell = (row: number, col: number) => {
    if (verdict) return;
    const q = current.question;
    if (q.kind !== "select-cells") return;
    const key = cellKey(row, col);
    const next = new Set(picks.cells);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicks({ cells: next, digits: picks.digits });
  };

  const tryAnother = () => {
    setVariantIndex((i) => i + 1);
  };

  const q = current.question;
  const targetSet =
    targetCellKey !== null ? new Set([targetCellKey]) : EMPTY_CONFLICTS;
  const selectedCellPos =
    q.kind === "place" || q.kind === "eliminate" ? q.cell : null;

  return (
    <div className="flex flex-col gap-4 w-full">
      <p className="text-sm text-text-secondary text-center leading-relaxed">
        <span className="label">Try it</span>
        <br />
        {current.prompt}
      </p>
      <div className="relative w-full max-w-lg mx-auto">
        <Board
          board={board}
          selectedCell={
            q.kind === "select-cells" ? null : (selectedCellPos ?? null)
          }
          selectedCells={q.kind === "select-cells" ? picks.cells : undefined}
          conflicts={EMPTY_CONFLICTS}
          hintCells={
            q.kind === "select-cells" && verdict?.correct === false
              ? new Set(q.cells.map((c) => cellKey(c.row, c.col)))
              : targetSet
          }
          onSelectCell={handleTapCell}
        />
      </div>
      {(q.kind === "place" || q.kind === "eliminate") && (
        <DigitPicker
          selected={picks.digits}
          allowed={
            q.kind === "place"
              ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
              : (current.initialCandidates.get(
                  cellKey(q.cell.row, q.cell.col),
                ) ?? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
          }
          onPick={handlePickDigit}
        />
      )}
      {q.kind !== "place" && !verdict && (
        <button
          type="button"
          className="btn btn-primary self-center px-6"
          onClick={() => handleCheck(q)}
        >
          Check
        </button>
      )}
      {verdict && (
        <div className="flex flex-col items-center gap-3">
          <span
            className={`text-base font-semibold ${verdict.correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {verdict.correct ? "✓ Correct!" : "✗ Not quite."}
          </span>
          <p className="text-sm text-text-secondary text-center max-w-prose leading-relaxed">
            {current.explanation}
          </p>
          {challenges.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary self-center px-6"
              onClick={tryAnother}
            >
              Try another
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function evaluate(
  q: ChallengeQuestion,
  picks: { cells: Set<number>; digits: Set<number> },
): boolean {
  if (q.kind === "place") {
    return picks.digits.size === 1 && picks.digits.has(q.value);
  }
  if (q.kind === "select-cells") {
    const expected = new Set(q.cells.map((c) => cellKey(c.row, c.col)));
    if (picks.cells.size !== expected.size) return false;
    for (const key of expected) if (!picks.cells.has(key)) return false;
    return true;
  }
  // eliminate
  const expected = new Set(q.digits);
  if (picks.digits.size !== expected.size) return false;
  for (const d of expected) if (!picks.digits.has(d)) return false;
  return true;
}

function DigitPicker({
  selected,
  allowed,
  onPick,
}: {
  selected: Set<number>;
  allowed: Set<number>;
  onPick: (digit: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const isAllowed = allowed.has(d);
        const isSelected = selected.has(d);
        return (
          <button
            key={d}
            type="button"
            disabled={!isAllowed}
            onClick={() => onPick(d)}
            className={`w-10 h-10 rounded-lg font-bold text-lg tabular-nums transition-colors ${
              isSelected
                ? "bg-accent text-text-on-accent"
                : isAllowed
                  ? "bg-bg-raised text-text-primary hover:bg-accent-light"
                  : "bg-bg-disabled text-text-disabled opacity-40"
            }`}
            aria-label={`${d}`}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
