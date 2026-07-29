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

  it("reads the board grid when the pointer is between cells", async () => {
    // The seams belong to the grid, not to any cell, and they are what
    // the pointer crosses on its way between them.
    const grid = document.createElement("div");
    grid.dataset.boardGrid = "true";
    document.body.append(grid);
    stackUnderPointer([grid]);

    renderHook(() => useHoverCursor());
    movePointer();
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBe("cell");
  });

  it("clears the affordance once the pointer leaves the board", async () => {
    // Left behind, a stale affordance would paint the grab cursor over
    // the entire page — the rule it drives is page-wide.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([cell]);
    renderHook(() => useHoverCursor());
    movePointer();
    await nextFrame();

    stackUnderPointer([document.createElement("div")]);
    movePointer();
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBeUndefined();
  });

  it("clears the affordance when the pointer leaves the document", async () => {
    // No pointermove reports the exit, so nothing else would clear it.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([cell]);
    renderHook(() => useHoverCursor());
    movePointer();
    await nextFrame();

    document.dispatchEvent(new PointerEvent("pointerleave"));

    expect(document.body.dataset.hoverCursor).toBeUndefined();
  });

  it("stays out of the way of a drag in progress", async () => {
    // A drag owns the cursor page-wide for its whole duration: the
    // pointer is carrying a digit, whatever it happens to be over.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([cell]);
    document.body.dataset.digitDrag = "true";

    renderHook(() => useHoverCursor());
    movePointer();
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBeUndefined();
  });

  it("ignores touch, which has no resting pointer", async () => {
    // A finger is only over the screen while it is touching it — there
    // is no hover state to advertise, and publishing one would leave a
    // cursor set for a device that has none.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([cell]);

    renderHook(() => useHoverCursor());
    movePointer("touch");
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBeUndefined();
  });

  it("hit-tests once per frame however fast the pointer moves", async () => {
    // pointermove fires faster than the screen repaints, and a hit test
    // per event would be work no one can see.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    const hits = vi.fn(() => [cell]);
    document.elementsFromPoint =
      hits as unknown as typeof document.elementsFromPoint;

    renderHook(() => useHoverCursor());
    movePointer();
    movePointer();
    movePointer();
    await nextFrame();

    expect(hits).toHaveBeenCalledTimes(1);
  });

  it("leaves the attribute alone while the affordance is unchanged", async () => {
    // Rewriting it on every frame of a slow drag across one cell would
    // invalidate style for the whole page each time.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([cell]);
    renderHook(() => useHoverCursor());
    movePointer();
    await nextFrame();

    let rewrites = 0;
    const observer = new MutationObserver((m) => {
      rewrites += m.length;
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-hover-cursor"],
    });
    movePointer();
    await nextFrame();
    observer.disconnect();

    expect(rewrites).toBe(0);
    expect(document.body.dataset.hoverCursor).toBe("grab");
  });

  it("looks past non-HTML nodes in the stack", async () => {
    // Injected layers are not always plain divs — an SVG icon sitting
    // over the board is still something to see past, not to stop at.
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    stackUnderPointer([svg, cell]);

    renderHook(() => useHoverCursor());
    movePointer();
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBe("grab");
  });

  it("stops reading the pointer once unmounted", async () => {
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    document.body.append(cell);
    stackUnderPointer([cell]);

    const { unmount } = renderHook(() => useHoverCursor());
    unmount();
    movePointer();
    await nextFrame();

    expect(document.body.dataset.hoverCursor).toBeUndefined();
  });
});
