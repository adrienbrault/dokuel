import { useEffect } from "react";

/** What the pointer can do here, in the order the stack is searched. */
const AFFORDANCES = [
  { attr: "cellFilled", cursor: "grab" },
  { attr: "numpadKeys", cursor: "grab" },
  { attr: "boardGrid", cursor: "cell" },
] as const;

function affordanceAt(x: number, y: number): string | null {
  // elementsFromPoint, not elementFromPoint: the topmost element under
  // the pointer is not necessarily ours. Browser extensions, password
  // managers and accessibility tools all inject full-viewport layers,
  // and the cursor is resolved from whichever of them wins the hit
  // test. Reading the whole stack finds the board underneath.
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement)) continue;
    for (const { attr, cursor } of AFFORDANCES) {
      if (el.dataset[attr] !== undefined) return cursor;
    }
  }
  return null;
}

/**
 * Publishes the affordance under the pointer as `data-hover-cursor` on
 * the body, so the cursor can be applied page-wide rather than only to
 * the board's own elements.
 *
 * The board and numpad already carry their cursors directly, which is
 * enough when nothing is stacked above them. When something is — and on
 * a real user's machine something usually is — those rules never reach
 * the element the browser actually resolves the cursor from, and the
 * pointer keeps the default arrow. The drag-time cursor never had this
 * problem because its rule was always page-wide; this gives the resting
 * cursor the same reach.
 */
export function useHoverCursor() {
  useEffect(() => {
    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;

    const apply = () => {
      frame = 0;
      // A drag owns the cursor page-wide while it lasts.
      if (document.body.dataset.digitDrag !== undefined) return;
      const cursor = affordanceAt(pendingX, pendingY);
      if (cursor === null) delete document.body.dataset.hoverCursor;
      else if (document.body.dataset.hoverCursor !== cursor)
        document.body.dataset.hoverCursor = cursor;
    };

    const onMove = (e: PointerEvent) => {
      // Touch has no resting pointer to advertise anything to.
      if (e.pointerType === "touch") return;
      pendingX = e.clientX;
      pendingY = e.clientY;
      // Hit testing once per frame: pointermove can outpace paint, and
      // the cursor only changes as often as the screen does.
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      delete document.body.dataset.hoverCursor;
    };

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      delete document.body.dataset.hoverCursor;
    };
  }, []);
}
