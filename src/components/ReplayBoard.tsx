import type { Board, Cell } from "../lib/types.ts";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

type ReplayBoardProps = {
  board: Board;
  /** Marks wrong digits; null for games from before rooms carried one. */
  solution: string | null;
  /** Cells the player changed in the step being shown. */
  changed: Set<number>;
  /** Names the board for screen readers. */
  label: string;
};

type CellState = "given" | "user" | "mistake" | "empty";

function stateOf(cell: Cell, solutionDigit: string | undefined): CellState {
  if (cell.value === null) return "empty";
  if (cell.isGiven) return "given";
  if (solutionDigit && String(cell.value) !== solutionDigit) return "mistake";
  return "user";
}

const INK: Record<CellState, string> = {
  given: "text-cell-given font-semibold",
  user: "text-cell-user font-semibold",
  mistake: "text-cell-conflict font-semibold",
  empty: "",
};

/**
 * An inert board for the match replay. Sized by its container rather
 * than the viewport (the live board's digits are sized in vw), so it
 * stays legible whether it fills the screen or shares it.
 */
export function ReplayBoard({
  board,
  solution,
  changed,
  label,
}: ReplayBoardProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="@container w-full aspect-square grid grid-cols-3 grid-rows-3 gap-[2px] bg-board-border p-[2px] shadow-lg shadow-black/8 dark:shadow-black/25"
    >
      {Array.from({ length: 9 }, (_, box) => (
        <div
          key={box}
          className="grid grid-cols-3 grid-rows-3 gap-px bg-border-default"
        >
          {Array.from({ length: 9 }, (_, i) => {
            const row = Math.floor(box / 3) * 3 + Math.floor(i / 3);
            const col = (box % 3) * 3 + (i % 3);
            const key = row * 9 + col;
            return (
              <ReplayCell
                key={key}
                cell={board[row]![col]!}
                row={row}
                col={col}
                state={stateOf(board[row]![col]!, solution?.[key])}
                changed={changed.has(key)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ReplayCell({
  cell,
  row,
  col,
  state,
  changed,
}: {
  cell: Cell;
  row: number;
  col: number;
  state: CellState;
  changed: boolean;
}) {
  const notes = [...cell.notes].sort((a, b) => a - b);
  const content =
    cell.value !== null
      ? `value ${cell.value}`
      : notes.length > 0
        ? `notes ${notes.join(" ")}`
        : "empty";
  const bg =
    state === "mistake"
      ? "bg-cell-conflict-bg"
      : changed
        ? "bg-cell-same-number"
        : "bg-cell-bg";
  return (
    <div
      role="img"
      aria-label={`Row ${row + 1} column ${col + 1}, ${content}`}
      data-state={state}
      data-changed={changed ? "true" : undefined}
      className={`relative flex items-center justify-center transition-colors duration-150 ${bg}`}
    >
      {cell.value !== null ? (
        <span className={`text-[6.5cqw] leading-none ${INK[state]}`}>
          {cell.value}
        </span>
      ) : notes.length > 0 ? (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {DIGITS.map((n) => (
            <span
              key={n}
              className="flex items-center justify-center text-[2.4cqw] leading-none text-text-secondary"
            >
              {cell.notes.has(n) ? n : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
