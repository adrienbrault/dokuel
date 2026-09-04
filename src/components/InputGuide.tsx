import { useState } from "react";
import { readJson, writeJson } from "../lib/storage.ts";

const SEEN_KEY = "sudoku_input_guide_seen";

/** A practice cell, isolated from the running game's board and history. */
export function InputGuide() {
  const [seen, setSeen] = useState(() => readJson(SEEN_KEY, false));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const [notes, setNotes] = useState(false);
  const [placed, setPlaced] = useState(false);
  const dismiss = () => {
    writeJson(SEEN_KEY, true);
    setSeen(true);
    setOpen(false);
  };
  return (
    <div className="w-full text-center" data-game-input-ignore>
      {!open ? (
        <button
          type="button"
          className="btn-ghost text-sm min-h-11"
          onClick={() => setOpen(true)}
        >
          {seen ? "How to play" : "Try the controls"}
        </button>
      ) : (
        <div className="card p-3 flex flex-col items-center gap-2">
          <p className="text-sm font-semibold">A quick practice</p>
          <p className="caption">
            {notes
              ? "Notes keeps small candidate digits in the cell."
              : "Select the cell, then tap a digit to fill it."}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Practice cell"
              aria-pressed={selected}
              className={`w-14 h-14 border-2 rounded-lg text-2xl ${selected ? "border-accent bg-accent-light" : "border-border-default"}`}
              onClick={() => setSelected(true)}
            >
              {placed && <span className={notes ? "text-xs" : ""}>5</span>}
            </button>
            <span aria-hidden="true" className="text-text-muted">
              ←
            </span>
            <button
              type="button"
              aria-label="Practice digit 5"
              disabled={!selected}
              className="btn btn-secondary w-12 h-12 disabled:opacity-40"
              onClick={() => setPlaced((value) => !value)}
            >
              5
            </button>
          </div>
          <p role="status" className="caption min-h-4">
            {placed
              ? notes
                ? "Note added. Tap again to remove it."
                : "Value placed. Now try a note."
              : "Tap the practice cell to select it."}
          </p>
          <p className="caption">
            On the board: hold a digit for a note, or drag it onto a cell. Drop
            high for a value, low for a note.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary px-3 min-h-11"
              onClick={() => {
                setNotes(true);
                setPlaced(false);
                setSelected(true);
              }}
            >
              Try notes
            </button>
            <button
              type="button"
              className="btn btn-primary px-3 min-h-11"
              onClick={dismiss}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
