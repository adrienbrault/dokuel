import { useEffect, useRef, useState } from "react";
import { parsePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { Board as BoardType, Position } from "../lib/types.ts";
import { Board } from "./Board.tsx";

// A fixed easy puzzle for the demo
const DEMO_PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const DEMO_SOLUTION = solvePuzzle(DEMO_PUZZLE);

type DemoAction =
  | { type: "select"; row: number; col: number }
  | { type: "deselect" }
  | { type: "notes-on" }
  | { type: "notes-off" }
  | { type: "note"; value: number }
  | { type: "place"; value: number };

// A scripted sequence of demo actions that loops
const DEMO_SCRIPT: DemoAction[] = [
  // Select an empty cell and add notes
  { type: "select", row: 0, col: 2 },
  { type: "notes-on" },
  { type: "note", value: 4 },
  { type: "note", value: 1 },
  { type: "notes-off" },
  { type: "deselect" },

  // Select another cell, add notes
  { type: "select", row: 0, col: 3 },
  { type: "notes-on" },
  { type: "note", value: 6 },
  { type: "note", value: 2 },
  { type: "note", value: 8 },
  { type: "notes-off" },
  { type: "deselect" },

  // Fill in a correct value
  { type: "select", row: 0, col: 5 },
  { type: "place", value: Number(DEMO_SOLUTION[5]) },
  { type: "deselect" },

  // Notes on another cell
  { type: "select", row: 1, col: 0 },
  { type: "notes-on" },
  { type: "note", value: 2 },
  { type: "note", value: 4 },
  { type: "notes-off" },
  { type: "deselect" },

  // Place another value
  { type: "select", row: 0, col: 4 },
  { type: "place", value: Number(DEMO_SOLUTION[4]) },
  { type: "deselect" },

  // Select and place in the middle area
  { type: "select", row: 2, col: 0 },
  { type: "place", value: Number(DEMO_SOLUTION[18]) },
  { type: "deselect" },

  // Notes on a cell
  { type: "select", row: 1, col: 3 },
  { type: "notes-on" },
  { type: "note", value: 8 },
  { type: "note", value: 4 },
  { type: "notes-off" },
  { type: "deselect" },
];

const EMPTY_CONFLICTS = new Set<number>();
const ACTION_INTERVAL_MS = 1500;

function cloneBoard(board: BoardType): BoardType {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      notes: new Set(cell.notes),
    })),
  );
}

export function DemoBoard() {
  const [board, setBoard] = useState<BoardType>(() => parsePuzzle(DEMO_PUZZLE));
  const [selectedCell, setSelectedCell] = useState<Position | null>(null);
  const notesModeRef = useRef(false);
  const stepRef = useRef(0);
  const cycleRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const step = stepRef.current;
      const action = DEMO_SCRIPT[step % DEMO_SCRIPT.length]!;

      switch (action.type) {
        case "select":
          setSelectedCell({ row: action.row, col: action.col });
          break;
        case "deselect":
          setSelectedCell(null);
          break;
        case "notes-on":
          notesModeRef.current = true;
          break;
        case "notes-off":
          notesModeRef.current = false;
          break;
        case "note":
          setBoard((prev) => {
            const next = cloneBoard(prev);
            const sel = DEMO_SCRIPT.slice(0, step)
              .reverse()
              .find((a) => a.type === "select") as
              | { type: "select"; row: number; col: number }
              | undefined;
            if (!sel) return prev;
            const cell = next[sel.row]![sel.col]!;
            if (cell.notes.has(action.value)) {
              cell.notes.delete(action.value);
            } else {
              cell.notes.add(action.value);
            }
            return next;
          });
          break;
        case "place":
          setBoard((prev) => {
            const next = cloneBoard(prev);
            const sel = DEMO_SCRIPT.slice(0, step)
              .reverse()
              .find((a) => a.type === "select") as
              | { type: "select"; row: number; col: number }
              | undefined;
            if (!sel) return prev;
            next[sel.row]![sel.col] = {
              value: action.value,
              isGiven: false,
              notes: new Set(),
            };
            return next;
          });
          break;
      }

      stepRef.current = step + 1;

      // Reset after full script completes
      if (stepRef.current >= DEMO_SCRIPT.length) {
        stepRef.current = 0;
        cycleRef.current += 1;
        // Reset board for next cycle
        setBoard(parsePuzzle(DEMO_PUZZLE));
        setSelectedCell(null);
        notesModeRef.current = false;
      }
    }, ACTION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-3/5 sm:w-full max-w-[20rem] mx-auto pointer-events-none select-none">
      <Board
        board={board}
        selectedCell={selectedCell}
        conflicts={EMPTY_CONFLICTS}
        onSelectCell={() => {}}
        assistLevel="standard"
      />
    </div>
  );
}
