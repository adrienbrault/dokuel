import { useEffect, useState } from "react";

/** Data attributes the cursor rules key off, shown as short marks. */
const MARKS: Record<string, string | undefined> = {
  boardGrid: "grid",
  cellFilled: "filled",
  numpadKeys: "keys",
};

function describeElement(el: Element): string {
  let out = el.tagName.toLowerCase();
  if (el.id) out += `#${el.id}`;
  if (el instanceof HTMLElement) {
    const marks = Object.keys(el.dataset)
      .map((key) => MARKS[key])
      .filter((mark): mark is string => mark !== undefined);
    if (marks.length > 0) out += `[${marks.join(",")}]`;
  }
  return out;
}

type Snapshot = {
  x: number;
  y: number;
  type: string;
  moves: number;
  leaves: number;
  stack: string[];
  cursor: string;
  hover: string;
  drag: boolean;
};

/**
 * Diagnostic overlay, mounted only when the URL contains
 * `?cursor-debug`. It reports what no remote test can observe: the
 * live hit-test stack under the pointer on the player's own browser
 * profile, where extensions and injected layers exist.
 *
 * Reading a screenshot of it:
 * - `0 iframe` (or any element that isn't ours) atop the stack — the
 *   cursor is resolved from that layer, not from the board. An iframe's
 *   cursor comes from its own document, out of reach of any page CSS.
 * - `leaves` climbing while the mouse sits still — a pointer-following
 *   overlay is arriving under the resting pointer; entering it fires
 *   pointerleave on our document.
 * - `body hover=…` — whether useHoverCursor published the affordance.
 * - The panel's presence at all — the build under test is one that has
 *   it; production and older previews render nothing.
 *
 * It keeps sampling at rest (250ms) because the interesting moment is
 * after the last pointermove, when a trailing overlay catches up.
 */
export function CursorDebugHud() {
  const enabled = window.location.search.includes("cursor-debug");
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let moves = 0;
    let leaves = 0;
    let x = 0;
    let y = 0;
    let type = "none";

    const sample = () => {
      frame = 0;
      const stack = document.elementsFromPoint(x, y);
      setSnap({
        x: Math.round(x),
        y: Math.round(y),
        type,
        moves,
        leaves,
        stack: stack.slice(0, 4).map(describeElement),
        cursor: stack[0] ? getComputedStyle(stack[0]).cursor : "-",
        hover: document.body.dataset.hoverCursor ?? "-",
        drag: document.body.dataset.digitDrag !== undefined,
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };
    const onMove = (e: PointerEvent) => {
      moves += 1;
      x = e.clientX;
      y = e.clientY;
      type = e.pointerType;
      schedule();
    };
    const onLeave = () => {
      leaves += 1;
      schedule();
    };

    const interval = setInterval(sample, 250);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      clearInterval(interval);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled || snap === null) return null;

  const hoverMq = window.matchMedia("(hover: hover)").matches;
  const fineMq = window.matchMedia("(pointer: fine)").matches;
  const lines = [
    "cursor-debug v1",
    `ptr ${snap.type} @${snap.x},${snap.y} moves ${snap.moves} leaves ${snap.leaves}`,
    `media hover=${String(hoverMq)} fine=${String(fineMq)}`,
    `body hover=${snap.hover} drag=${String(snap.drag)}`,
    `computed ${snap.cursor}`,
    ...snap.stack.map((entry, i) => `${i} ${entry}`),
  ];

  return (
    <div
      data-testid="cursor-debug-hud"
      className="fixed top-2 left-2 z-[9999] pointer-events-none select-none rounded-md bg-black/80 px-2 py-1.5 font-mono text-[10px] leading-snug text-white whitespace-pre"
    >
      {lines.join("\n")}
    </div>
  );
}
