import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIGITS } from "../lib/constants.ts";
import type { NumPadPosition } from "../lib/types.ts";
import { type DigitDrop, useDigitGesture } from "./useDigitGesture.ts";

/**
 * The recognizer owns one pressed digit from pointerdown to drop, so it
 * is exercised the way a finger uses it: a real digit row it can
 * hit-test, and a stubbed `elementFromPoint` standing in for the board
 * underneath. Everything these cases pin used to be split across
 * NumPad.test.tsx, useDigitDrag.test.ts and useGameDigitDrag.test.ts.
 */

type HarnessProps = {
  position?: NumPadPosition;
  disabled?: boolean;
  onTap?: (n: number) => void;
  onHold?: ((n: number) => void) | undefined;
  onSkim?: ((n: number) => void) | undefined;
  onEnd?: (() => void) | undefined;
  isDroppable?: (row: number, col: number, digit: number) => boolean;
  onDrop?: (drop: DigitDrop) => void;
  /** Digits whose key renders disabled, as a completed digit does. */
  completed?: number[];
};

const api: { current: ReturnType<typeof useDigitGesture> | null } = {
  current: null,
};

function gesture() {
  const current = api.current;
  if (!current) throw new Error("harness not rendered");
  return current;
}

function Harness({
  position = "bottom",
  disabled,
  onTap = () => {},
  onHold,
  onSkim,
  onEnd,
  isDroppable = () => true,
  onDrop = () => {},
  completed = [],
}: HarnessProps) {
  const recognizer = useDigitGesture({
    position,
    disabled,
    onTap,
    onHold,
    onSkim,
    onEnd,
    isDroppable,
    onDrop,
  });
  api.current = recognizer;
  return (
    <div ref={recognizer.groupRef} role="group" aria-label="Number pad">
      {DIGITS.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={String(n)}
          data-numpad-digit={n}
          disabled={completed.includes(n)}
          {...recognizer.keyProps(n)}
        />
      ))}
    </div>
  );
}

function key(n: number) {
  return screen.getByRole("button", { name: String(n) });
}

function mockElementFromPoint(get: (x: number, y: number) => Element | null) {
  document.elementFromPoint = ((x: number, y: number) =>
    get(x, y)) as typeof document.elementFromPoint;
}

function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = (() => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => {},
    ...rect,
  })) as typeof el.getBoundingClientRect;
}

/** A detached board cell, hit-tested through the mocked elementFromPoint. */
function makeCell(
  row: number,
  col: number,
  rect = { left: 0, top: 0, width: 100, height: 100 },
): HTMLElement {
  const el = document.createElement("button");
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  mockRect(el, {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  });
  return el;
}

function makeNumpadButton(digit: number): HTMLElement {
  const el = document.createElement("button");
  el.dataset.numpadDigit = String(digit);
  return el;
}

function docPointer(type: string, init: Partial<PointerEvent> = {}) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...init,
  });
}

/** Press `digit`, then pull perpendicular to a bottom pad → a drag. */
function pressAndPullOff(digit: number, pointerType = "mouse") {
  const btn = key(digit);
  fireEvent.pointerDown(btn, {
    pointerType,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(btn, {
    pointerType,
    pointerId: 1,
    clientX: 0,
    clientY: 50,
  });
  return btn;
}

/** Press `digit`, then pan along a bottom pad's axis → a skim. */
function pressAndSkim(digit: number, pointerType = "touch") {
  const btn = key(digit);
  fireEvent.pointerDown(btn, {
    pointerType,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(btn, {
    pointerType,
    pointerId: 1,
    clientX: 50,
    clientY: 0,
  });
  return btn;
}

beforeEach(() => {
  vi.useFakeTimers();
  api.current = null;
  document.elementFromPoint = (() => null) as typeof document.elementFromPoint;
});

afterEach(() => {
  vi.useRealTimers();
  document.elementFromPoint = (() => null) as typeof document.elementFromPoint;
});

describe("useDigitGesture press", () => {
  it("fires onTap on pointerup for a quick tap", () => {
    const onTap = vi.fn();
    render(<Harness onTap={onTap} />);
    fireEvent.pointerDown(key(7), { pointerType: "touch" });
    // pointerdown alone commits nothing — the value waits for release.
    expect(onTap).not.toHaveBeenCalled();
    fireEvent.pointerUp(key(7), { pointerType: "touch" });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(7);
  });

  it("does not double-fire onTap when a click follows a pointer tap", () => {
    const onTap = vi.fn();
    render(<Harness onTap={onTap} />);
    fireEvent.pointerDown(key(7), { pointerType: "touch" });
    fireEvent.pointerUp(key(7), { pointerType: "touch" });
    fireEvent.click(key(7));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("fires onTap on a click with no pointer (keyboard activation)", () => {
    const onTap = vi.fn();
    render(<Harness onTap={onTap} />);
    fireEvent.click(key(7));
    expect(onTap).toHaveBeenCalledWith(7);
  });

  it("does not tap when the click after a skim lands on the origin key", () => {
    // A mouse skim that starts and ends over the same key still ends
    // with a browser click on that key. It is the tail of a gesture the
    // skim already consumed, not an assistive-tech activation — honoring
    // it toggled the highlight straight back off on release.
    const onTap = vi.fn();
    render(<Harness onTap={onTap} onSkim={vi.fn()} />);
    const three = pressAndSkim(3, "mouse");
    // ...and back onto the key it started on, where the mouse is released.
    fireEvent.pointerUp(three, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.click(three);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("does not tap when the click after a drag handoff lands on the origin key", () => {
    const onTap = vi.fn();
    render(<Harness onTap={onTap} />);
    const three = pressAndPullOff(3);
    fireEvent.pointerUp(three, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.click(three);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("fires onHold at 200ms and not onTap on the release", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    render(<Harness onTap={onTap} onHold={onHold} />);
    fireEvent.pointerDown(key(4), { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onHold).toHaveBeenCalledWith(4);
    fireEvent.pointerUp(key(4), { pointerType: "touch" });
    fireEvent.click(key(4));
    // A completed hold consumes the gesture — the release is not also a tap.
    expect(onTap).not.toHaveBeenCalled();
  });

  it("fires onTap, not onHold, when released before 200ms", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    render(<Harness onTap={onTap} onHold={onHold} />);
    fireEvent.pointerDown(key(2), { pointerType: "touch" });
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(key(2), { pointerType: "touch" });
    fireEvent.click(key(2));
    expect(onHold).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(2);
  });

  it("cancels the hold and fires nothing when the pointer leaves the button", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    render(<Harness onTap={onTap} onHold={onHold} />);
    fireEvent.pointerDown(key(6), { pointerType: "touch" });
    fireEvent.pointerLeave(key(6));
    vi.advanceTimersByTime(500);
    expect(onHold).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("keeps an off-center press with slight wobble a tap", () => {
    // Desktop bug: gesture slop was measured from the BUTTON CENTER,
    // so on a 64px button any press landing >12px off-center (~87% of
    // its area) was "past the threshold" before the pointer moved at
    // all — 3px of natural mouse wobble then misfired a skim or drag
    // and swallowed the tap.
    const onTap = vi.fn();
    const onSkim = vi.fn();
    render(<Harness onTap={onTap} onHold={vi.fn()} onSkim={onSkim} />);
    const five = key(5);
    mockRect(five, {
      left: 0,
      top: 0,
      right: 64,
      bottom: 64,
      width: 64,
      height: 64,
    });
    fireEvent.pointerDown(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 56,
      clientY: 40,
    });
    fireEvent.pointerMove(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 59,
      clientY: 41,
    });
    fireEvent.pointerUp(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 59,
      clientY: 41,
    });
    expect(gesture().dragState).toBeNull();
    expect(onSkim).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledWith(5);
  });

  it("shows the pressed digit and clears it on release", () => {
    render(<Harness />);
    fireEvent.pointerDown(key(3), {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    expect(gesture().pressedDigit).toBe(3);
    fireEvent.pointerUp(key(3), { pointerType: "touch", pointerId: 1 });
    expect(gesture().pressedDigit).toBeNull();
  });

  it("calls onEnd on the release after a quick tap", () => {
    const onEnd = vi.fn();
    render(<Harness onHold={vi.fn()} onEnd={onEnd} />);
    fireEvent.pointerDown(key(8), { pointerType: "touch" });
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(key(8), { pointerType: "touch" });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("calls onEnd on the release after a hold fired", () => {
    const onEnd = vi.fn();
    render(<Harness onHold={vi.fn()} onEnd={onEnd} />);
    fireEvent.pointerDown(key(1), { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(key(1), { pointerType: "touch" });
    expect(onEnd).toHaveBeenCalled();
  });
});

// jsdom implements no pointer capture at all, so a captured press is
// staged by hand: the stubs stand in for the browser's, and moves are
// fired at the origin button the way a capturing browser retargets
// them there even once the cursor has left it.
function stubPointerCapture(el: HTMLElement) {
  el.setPointerCapture = vi.fn();
  el.releasePointerCapture = vi.fn();
}

describe("useDigitGesture classification", () => {
  it("starts a drag when the pan is perpendicular to the pad's axis", () => {
    const onSkim = vi.fn();
    render(<Harness onHold={vi.fn()} onSkim={onSkim} />);
    const three = key(3);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Small drift — under the slop.
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 4,
      clientY: 4,
    });
    expect(gesture().dragState).toBeNull();
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 50,
    });
    expect(gesture().dragState).toMatchObject({
      digit: 3,
      source: { kind: "numpad" },
      x: 0,
      y: 50,
    });
    expect(onSkim).not.toHaveBeenCalled();
  });

  it("does not start a drag when the pan is along the pad's axis", () => {
    render(<Harness onHold={vi.fn()} onSkim={vi.fn()} />);
    pressAndSkim(3);
    expect(gesture().dragState).toBeNull();
  });

  it("treats a shallow diagonal pan as a skim, outside the drag cone", () => {
    render(<Harness onHold={vi.fn()} onSkim={vi.fn()} />);
    const three = key(3);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // A pan ~37° off the board-facing axis sits outside the 60° drag
    // cone — diagonal enough to read as an along-axis skim, not a drag.
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 30, clientY: 40 });
    expect(gesture().dragState).toBeNull();
  });

  it("classifies drag direction from the movement, not the press position", () => {
    // A perpendicular pull toward the board must read as a drag even
    // when the press landed off-center — with the old center-relative
    // origin, the press position dominated the angle and an upward
    // 20px pull from a right-edge press was misread as a skim.
    const onSkim = vi.fn();
    render(<Harness onHold={vi.fn()} onSkim={onSkim} />);
    const five = key(5);
    mockRect(five, {
      left: 0,
      top: 0,
      right: 64,
      bottom: 64,
      width: 64,
      height: 64,
    });
    fireEvent.pointerDown(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 56,
      clientY: 40,
    });
    fireEvent.pointerMove(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 56,
      clientY: 20,
    });
    expect(onSkim).not.toHaveBeenCalled();
    expect(gesture().dragState).toMatchObject({ digit: 5, x: 56, y: 20 });
  });

  it("falls back to a drag in any direction when no skim handler is wired", () => {
    render(<Harness onHold={vi.fn()} />);
    pressAndSkim(3);
    expect(gesture().dragState).toMatchObject({ digit: 3 });
  });

  it("classifies along-axis as the Y axis when the pad is vertical", () => {
    const onSkim = vi.fn();
    render(<Harness position="right" onSkim={onSkim} />);
    const three = key(3);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 0, clientY: 50 });
    expect(gesture().dragState).toBeNull();
    expect(onSkim).not.toHaveBeenCalled(); // still on the original digit
  });

  it("cancels the hold timer once a drag begins", () => {
    const onHold = vi.fn();
    render(<Harness onHold={onHold} />);
    const five = key(5);
    fireEvent.pointerDown(five, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(five, { pointerId: 1, clientX: 40, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onHold).not.toHaveBeenCalled();
  });

  it("classifies a press once: a further move only tracks the live drag", () => {
    // The classification forgets the press, so nothing can promote a
    // second time — onEnd, which fires at the promotion, counts it.
    const onEnd = vi.fn();
    render(<Harness onEnd={onEnd} />);
    const nine = key(9);
    fireEvent.pointerDown(nine, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(nine, { pointerId: 1, clientX: 50, clientY: 0 });
    fireEvent.pointerMove(nine, { pointerId: 1, clientX: 100, clientY: 0 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(gesture().dragState).toMatchObject({ digit: 9, x: 100 });
  });

  it("keeps a captured mouse press alive when the cursor leaves the key", () => {
    // Mice get no implicit capture: a press landing within the slop of a
    // key's edge crosses the boundary before the pan classifies, and the
    // button-scoped pointerleave then killed the whole gesture — no
    // drag, no skim, no tap. A captured press owns the pointer until it
    // classifies, so the leave is not the end of anything.
    render(<Harness onHold={vi.fn()} onSkim={vi.fn()} />);
    const three = key(3);
    stubPointerCapture(three);
    fireEvent.pointerDown(three, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    expect(three.setPointerCapture).toHaveBeenCalledWith(1);
    // 5px toward the board — under the slop, already off the key.
    fireEvent.pointerLeave(three, { pointerType: "mouse", pointerId: 1 });
    fireEvent.pointerMove(three, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: -40,
    });
    expect(gesture().dragState).toMatchObject({
      digit: 3,
      source: { kind: "numpad" },
      x: 0,
      y: -40,
      lift: 0,
    });
  });

  it("still skims after a captured mouse press leaves the key", () => {
    const onSkim = vi.fn();
    render(<Harness onSkim={onSkim} />);
    const three = key(3);
    stubPointerCapture(three);
    fireEvent.pointerDown(three, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerLeave(three, { pointerType: "mouse", pointerId: 1 });
    fireEvent.pointerMove(three, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 50,
      clientY: 0,
    });
    mockElementFromPoint(() => key(5));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    expect(onSkim).toHaveBeenCalledWith(5);
  });
});

describe("useDigitGesture skim", () => {
  it("fires onSkim when the finger crosses into a different digit", () => {
    const onSkim = vi.fn();
    render(<Harness onHold={vi.fn()} onSkim={onSkim} />);
    pressAndSkim(3);
    // Still on the original digit — no transition yet.
    expect(onSkim).not.toHaveBeenCalled();

    mockElementFromPoint(() => key(5));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    expect(onSkim).toHaveBeenCalledTimes(1);
    expect(onSkim).toHaveBeenCalledWith(5);
  });

  it("does not refire onSkim for the same digit on every move", () => {
    const onSkim = vi.fn();
    render(<Harness onSkim={onSkim} />);
    pressAndSkim(3);
    mockElementFromPoint(() => key(5));
    act(() => {
      for (const clientX of [100, 110, 120]) {
        document.dispatchEvent(
          docPointer("pointermove", { pointerId: 1, clientX, clientY: 0 }),
        );
      }
    });
    expect(onSkim).toHaveBeenCalledTimes(1);
  });

  it("moves the pressed digit onto the digit under the finger", () => {
    render(<Harness onSkim={vi.fn()} />);
    pressAndSkim(3);
    expect(gesture().pressedDigit).toBe(3);
    mockElementFromPoint(() => key(5));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    // The press visual must follow the finger — the original digit lets
    // go, the new one picks up.
    expect(gesture().pressedDigit).toBe(5);
  });

  it("does not skim onto a disabled (completed) digit", () => {
    // Completed digits are visually hidden, so flashing them as the
    // finger drifts past would surprise the player.
    const onSkim = vi.fn();
    render(<Harness onSkim={onSkim} completed={[5]} />);
    pressAndSkim(3);
    mockElementFromPoint(() => key(5));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    expect(onSkim).not.toHaveBeenCalled();
  });

  it("fires onEnd when a skim is released", () => {
    const onEnd = vi.fn();
    render(<Harness onEnd={onEnd} onSkim={vi.fn()} />);
    pressAndSkim(3);
    act(() => {
      document.dispatchEvent(docPointer("pointerup", { pointerId: 1 }));
    });
    expect(onEnd).toHaveBeenCalled();
    expect(gesture().pressedDigit).toBeNull();
  });
});

describe("useDigitGesture promotion", () => {
  function padSpans(top: number, bottom: number, left: number, right: number) {
    mockRect(screen.getByRole("group", { name: "Number pad" }), {
      top,
      bottom,
      left,
      right,
    });
  }

  it("promotes a skim into a drag when the finger pulls off the pad toward the board", () => {
    const onSkim = vi.fn();
    const onEnd = vi.fn();
    render(<Harness onSkim={onSkim} onEnd={onEnd} />);
    // Numpad button row spans y∈[0,80]; the board sits above (y<0).
    padSpans(0, 80, 0, 300);
    const three = key(3);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 80,
      clientY: 20,
    });
    // Finger skims onto digit 5 while still over the numpad row.
    mockElementFromPoint(() => key(5));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 140, clientY: 20 }),
      );
    });
    expect(onSkim).toHaveBeenLastCalledWith(5);
    expect(gesture().dragState).toBeNull();

    // Finger lifts off the numpad toward the board → drag-to-place,
    // carrying the skimmed digit (5), not the pressed one (3).
    mockElementFromPoint(() => null);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 140, clientY: -10 }),
      );
    });
    expect(gesture().dragState).toMatchObject({
      digit: 5,
      source: { kind: "numpad" },
      x: 140,
      y: -10,
      // A touch gesture carries the touch lift into the drag.
      lift: 46,
    });
    expect(gesture().pressedDigit).toBeNull();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("does not promote a skim when the finger slides off the pad's end", () => {
    render(<Harness onSkim={vi.fn()} />);
    padSpans(0, 80, 0, 300);
    const three = key(3);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 80,
      clientY: 20,
    });
    // Finger runs past the right end, still level with the numpad row.
    mockElementFromPoint(() => null);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 360, clientY: 20 }),
      );
    });
    expect(gesture().dragState).toBeNull();
  });

  it("promotes a skim on a vertical pad when the finger pulls toward the board", () => {
    render(<Harness position="right" onSkim={vi.fn()} />);
    // Right numpad column spans x∈[0,60]; the board sits to the left.
    padSpans(0, 600, 0, 60);
    const three = key(3);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Vertical pan = along-axis for a vertical numpad → skim.
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 10,
      clientY: 80,
    });
    mockElementFromPoint(() => key(5));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 10, clientY: 140 }),
      );
    });
    expect(gesture().dragState).toBeNull();
    // Finger pulls left toward the board, off the numpad column.
    mockElementFromPoint(() => null);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: -20, clientY: 140 }),
      );
    });
    expect(gesture().dragState).toMatchObject({ digit: 5, x: -20, y: 140 });
  });

  it("fires onEnd once when a drag handoff is followed by the release", () => {
    // The handoff ends the press: the drag owns the gesture from there.
    // The release the origin key still receives is the tail of a press
    // that is already over, and must not end it a second time — onEnd
    // is not promised to be idempotent.
    const onEnd = vi.fn();
    render(<Harness onEnd={onEnd} />);
    const three = pressAndPullOff(3, "touch");
    expect(onEnd).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(three, { pointerType: "touch", pointerId: 1 });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe("useDigitGesture drag and drop", () => {
  it("carries no drag before a gesture starts", () => {
    render(<Harness />);
    expect(gesture().dragState).toBeNull();
  });

  it("tracks the pointer and the cell under it while dragging", () => {
    mockElementFromPoint(() => makeCell(3, 4));
    render(<Harness />);
    pressAndPullOff(7);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 150, clientY: 250 }),
      );
    });
    expect(gesture().dragState).toMatchObject({
      x: 150,
      y: 250,
      target: { row: 3, col: 4 },
      invalidTarget: false,
    });
  });

  it("marks the target invalid when isDroppable says no", () => {
    mockElementFromPoint(() => makeCell(0, 0));
    render(<Harness isDroppable={() => false} />);
    pressAndPullOff(1);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 10, clientY: 10 }),
      );
    });
    expect(gesture().dragState).toMatchObject({
      target: { row: 0, col: 0 },
      invalidTarget: true,
    });
  });

  it("asks isDroppable about the carried digit", () => {
    mockElementFromPoint(() => makeCell(2, 6));
    const isDroppable = vi.fn(() => true);
    render(<Harness isDroppable={isDroppable} />);
    pressAndPullOff(8);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 10, clientY: 10 }),
      );
    });
    expect(isDroppable).toHaveBeenCalledWith(2, 6, 8);
  });

  it("drops a value when the release lands in the cell's top half", () => {
    // Cell occupies (0,0)→(100,100). A mouse takes no lift, so clientY
    // 30 is local Y 30 — above the horizontal midline.
    mockElementFromPoint(() => makeCell(5, 6));
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    pressAndPullOff(9);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 30 }),
      );
      document.dispatchEvent(
        docPointer("pointerup", { clientX: 50, clientY: 30 }),
      );
    });
    expect(onDrop).toHaveBeenCalledWith({
      digit: 9,
      mode: "value",
      target: { row: 5, col: 6 },
      from: null,
    });
    expect(gesture().dragState).toBeNull();
  });

  it("drops a note when the release lands in the cell's bottom half", () => {
    mockElementFromPoint(() => makeCell(3, 4));
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    pressAndPullOff(7);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 10, clientY: 85 }),
      );
      document.dispatchEvent(
        docPointer("pointerup", { clientX: 10, clientY: 85 }),
      );
    });
    expect(onDrop).toHaveBeenCalledWith({
      digit: 7,
      mode: "note",
      target: { row: 3, col: 4 },
      from: null,
    });
  });

  it("lifts the hit point above the finger for touch pointers", () => {
    // Touch drags lift the hit test 46px: clientY 80 resolves to local
    // Y 34, above the midline → value. Without the lift the raw clientY
    // 80 would land in the bottom (note) half, so a "value" result
    // proves the lift was applied.
    mockElementFromPoint(() => makeCell(2, 3));
    render(<Harness />);
    pressAndPullOff(6, "touch");
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 80 }),
      );
    });
    expect(gesture().dragState).toMatchObject({ lift: 46, mode: "value" });
  });

  it("fires onDrop exactly once per drop under StrictMode", () => {
    // onDrop used to be invoked INSIDE the setState updater; StrictMode
    // double-invokes updaters in dev, and a note drop is a toggle — the
    // dropped pencil mark toggled twice and silently vanished in every
    // dev session.
    mockElementFromPoint(() => makeCell(3, 4));
    const onDrop = vi.fn();
    render(
      <StrictMode>
        <Harness onDrop={onDrop} />
      </StrictMode>,
    );
    pressAndPullOff(5);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 80 }),
      );
    });
    act(() => {
      document.dispatchEvent(docPointer("pointerup"));
    });
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(gesture().dragState).toBeNull();
  });

  it("cancels without a drop when released off the grid", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    pressAndPullOff(4);
    act(() => {
      document.dispatchEvent(
        docPointer("pointerup", { clientX: 0, clientY: 0 }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(gesture().dragState).toBeNull();
  });

  it("cancels without a drop when released over a non-droppable cell", () => {
    mockElementFromPoint(() => makeCell(2, 2));
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} isDroppable={() => false} />);
    pressAndPullOff(4);
    act(() => {
      document.dispatchEvent(
        docPointer("pointerup", { clientX: 0, clientY: 0 }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(gesture().dragState).toBeNull();
  });

  it("ignores pointer events from other pointers", () => {
    mockElementFromPoint(() => makeCell(0, 0));
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    pressAndPullOff(1);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", {
          pointerId: 2,
          clientX: 999,
          clientY: 999,
        }),
      );
      document.dispatchEvent(docPointer("pointerup", { pointerId: 2 }));
    });
    // The drag is still live because pointer 2 isn't ours.
    expect(gesture().dragState).toMatchObject({ x: 0, y: 50 });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    pressAndPullOff(2);
    act(() => {
      document.dispatchEvent(docPointer("pointercancel"));
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(gesture().dragState).toBeNull();
  });

  it("cancels when Escape is pressed", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    pressAndPullOff(3);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(gesture().dragState).toBeNull();
  });

  it("starts no drag and drops nothing while disabled", () => {
    mockElementFromPoint(() => makeCell(0, 0));
    const onDrop = vi.fn();
    render(<Harness disabled onDrop={onDrop} />);
    pressAndPullOff(5);
    expect(gesture().dragState).toBeNull();
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 30 }),
      );
      document.dispatchEvent(
        docPointer("pointerup", { clientX: 50, clientY: 30 }),
      );
    });
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe("useDigitGesture demotion", () => {
  // Board cells sit above y=400; a numpad digit-7 button below it.
  function boardAboveNumpad(_x: number, y: number) {
    return y >= 400 ? makeNumpadButton(7) : makeCell(3, 4);
  }

  function startDragOverNumpad(digit: number) {
    const btn = key(digit);
    fireEvent.pointerDown(btn, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 50,
      clientY: 460,
    });
    fireEvent.pointerMove(btn, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 50,
      clientY: 410,
    });
  }

  it("demotes a numpad drag back to a live skim when it returns over the digits", () => {
    mockElementFromPoint(boardAboveNumpad);
    const onDrop = vi.fn();
    const onSkim = vi.fn();
    render(<Harness onDrop={onDrop} onSkim={onSkim} />);
    startDragOverNumpad(5);
    expect(gesture().dragState).not.toBeNull();

    // Still over the numpad — the drag has not left it yet, so a move
    // here must not demote it.
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 460 }),
      );
    });
    expect(onSkim).not.toHaveBeenCalled();
    expect(gesture().dragState).not.toBeNull();

    // Out over the board.
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 100 }),
      );
    });
    // Back over the numpad — the drag now demotes to a skim on the
    // digit under the finger.
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 450 }),
      );
    });
    expect(onSkim).toHaveBeenCalledTimes(1);
    expect(onSkim).toHaveBeenCalledWith(7);
    expect(gesture().dragState).toBeNull();
    expect(gesture().pressedDigit).toBe(7);
    expect(onDrop).not.toHaveBeenCalled();

    // The resumed skim is live: sliding onto another digit highlights it.
    mockElementFromPoint(() => key(9));
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 60, clientY: 450 }),
      );
    });
    expect(onSkim).toHaveBeenLastCalledWith(9);
    expect(gesture().pressedDigit).toBe(9);
  });

  it("does not demote a cell-sourced drag that passes over the numpad", () => {
    mockElementFromPoint(boardAboveNumpad);
    const onSkim = vi.fn();
    render(<Harness onSkim={onSkim} />);
    act(() => {
      gesture().startCellDrag({
        digit: 5,
        from: { row: 3, col: 4 },
        x: 50,
        y: 100,
        pointerId: 1,
        pointerType: "mouse",
      });
    });
    // Out over the board, then back over the numpad — a drag that began
    // on a cell has no skim to resume, so it stays a drag throughout.
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 100 }),
      );
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 450 }),
      );
    });
    expect(onSkim).not.toHaveBeenCalled();
    expect(gesture().dragState).not.toBeNull();
  });
});

describe("useDigitGesture cell-sourced drag", () => {
  it("drops a note carrying the cell the digit came from", () => {
    mockElementFromPoint(() => makeCell(0, 0));
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    act(() => {
      gesture().startCellDrag({
        digit: 7,
        from: { row: 3, col: 4 },
        x: 0,
        y: 0,
        pointerId: 1,
        pointerType: "mouse",
      });
    });
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { clientX: 50, clientY: 85 }),
      );
      document.dispatchEvent(
        docPointer("pointerup", { clientX: 50, clientY: 85 }),
      );
    });
    expect(onDrop).toHaveBeenCalledWith({
      digit: 7,
      mode: "note",
      target: { row: 0, col: 0 },
      from: { row: 3, col: 4 },
    });
  });

  it("starts no cell drag while disabled", () => {
    mockElementFromPoint(() => makeCell(0, 0));
    render(<Harness disabled />);
    act(() => {
      gesture().startCellDrag({
        digit: 7,
        from: { row: 3, col: 4 },
        x: 0,
        y: 0,
        pointerId: 1,
        pointerType: "mouse",
      });
    });
    expect(gesture().dragState).toBeNull();
  });
});
