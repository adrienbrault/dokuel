import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHoverCursor } from "./useHoverCursor.ts";

/**
 * Hit testing is layout, which jsdom does not do — elementsFromPoint is
 * the boundary this hook reads the page through, so it is the one thing
 * stubbed here. Everything else is the real hook against the real DOM.
 */
function stackUnderPointer(stack: Element[]) {
  document.elementsFromPoint = (() =>
    stack) as typeof document.elementsFromPoint;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
}

function movePointer(pointerType = "mouse") {
  window.dispatchEvent(
    new PointerEvent("pointermove", { clientX: 10, clientY: 10, pointerType }),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
  delete document.body.dataset.hoverCursor;
  delete document.body.dataset.digitDrag;
  vi.unstubAllGlobals();
});

describe("useHoverCursor", () => {
  it("names the affordance on the body so a stacked overlay inherits it", async () => {
    // The cursor is resolved from the topmost hit-testable element under
    // the pointer. A browser extension's overlay sits above the board, so
    // a rule scoped to cells never reaches it and the arrow stays. Naming
    // the affordance on the body lets the page-wide rule cover whatever
    // is stacked there — the same reason the drag cursor already works.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([document.createElement("div"), cell]);

    renderHook(() => useHoverCursor());
    movePointer();
    // The hook hit-tests once per frame — the cursor can only change as
    // often as the screen does.
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBe("grab");
  });
});
