import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumPad, type NumPadHandle } from "./NumPad.tsx";

const ZERO_REMAINING = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };

function mockElementFromPoint(el: HTMLElement | null) {
  document.elementFromPoint = (() => el) as typeof document.elementFromPoint;
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

describe("NumPad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  it("fires onTapNumber on pointerup for a quick tap", () => {
    const onTapNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
      />,
    );
    const seven = screen.getByRole("button", { name: /^7, / });
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    // pointerdown alone commits nothing — the value waits for release.
    expect(onTapNumber).not.toHaveBeenCalled();
    fireEvent.pointerUp(seven, { pointerType: "touch" });
    expect(onTapNumber).toHaveBeenCalledTimes(1);
    expect(onTapNumber).toHaveBeenCalledWith(7);
  });

  it("offers a grab cursor on the digit keys when they can be dragged", () => {
    // A key is not just a button: it can be picked up and dropped onto
    // a cell. Desktop players only find that out by accident unless the
    // cursor says so.
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^7, / }).className).toContain(
      "cursor-grab",
    );
  });

  it("does not double-fire onTapNumber when click follows a pointer tap", () => {
    const onTapNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
      />,
    );
    const seven = screen.getByRole("button", { name: /^7, / });
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    fireEvent.pointerUp(seven, { pointerType: "touch" });
    fireEvent.click(seven);
    expect(onTapNumber).toHaveBeenCalledTimes(1);
  });

  it("fires onTapNumber on click without pointer (keyboard activation)", () => {
    const onTapNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
      />,
    );
    const seven = screen.getByRole("button", { name: /^7, / });
    fireEvent.click(seven);
    expect(onTapNumber).toHaveBeenCalledWith(7);
  });

  it("fires onHoldNumber at 200ms and not onTapNumber on the release", () => {
    const onTapNumber = vi.fn();
    const onHoldNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
        onHoldNumber={onHoldNumber}
      />,
    );
    const four = screen.getByRole("button", { name: /^4, / });
    fireEvent.pointerDown(four, { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onHoldNumber).toHaveBeenCalledWith(4);
    fireEvent.pointerUp(four, { pointerType: "touch" });
    fireEvent.click(four);
    // A completed hold consumes the gesture — the release is not also a tap.
    expect(onTapNumber).not.toHaveBeenCalled();
  });

  it("fires onTapNumber, not onHoldNumber, when released before 200ms", () => {
    const onTapNumber = vi.fn();
    const onHoldNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
        onHoldNumber={onHoldNumber}
      />,
    );
    const two = screen.getByRole("button", { name: /^2, / });
    fireEvent.pointerDown(two, { pointerType: "touch" });
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(two, { pointerType: "touch" });
    fireEvent.click(two);
    expect(onHoldNumber).not.toHaveBeenCalled();
    expect(onTapNumber).toHaveBeenCalledTimes(1);
    expect(onTapNumber).toHaveBeenCalledWith(2);
  });

  it("cancels the hold and fires nothing when the pointer leaves the button", () => {
    const onTapNumber = vi.fn();
    const onHoldNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
        onHoldNumber={onHoldNumber}
      />,
    );
    const six = screen.getByRole("button", { name: /^6, / });
    fireEvent.pointerDown(six, { pointerType: "touch" });
    fireEvent.pointerLeave(six);
    vi.advanceTimersByTime(500);
    expect(onHoldNumber).not.toHaveBeenCalled();
    expect(onTapNumber).not.toHaveBeenCalled();
  });

  it("calls onPressEnd on pointer release (after a quick tap)", () => {
    const onPressEnd = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onPressEnd={onPressEnd}
      />,
    );
    const eight = screen.getByRole("button", { name: /^8, / });
    fireEvent.pointerDown(eight, { pointerType: "touch" });
    expect(onPressEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(eight, { pointerType: "touch" });
    expect(onPressEnd).toHaveBeenCalledTimes(1);
  });

  it("calls onPressEnd after a hold fires (on release)", () => {
    const onPressEnd = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onPressEnd={onPressEnd}
      />,
    );
    const one = screen.getByRole("button", { name: /^1, / });
    fireEvent.pointerDown(one, { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(one, { pointerType: "touch" });
    expect(onPressEnd).toHaveBeenCalled();
  });

  it("renders the discoverability caption above the digits", () => {
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
      />,
    );
    expect(screen.getByText(/tap = enter · hold = note/i)).toBeInTheDocument();
  });

  it("starts a drag when the pan is perpendicular to the numpad axis", () => {
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Small drift — under threshold
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 4,
      clientY: 4,
    });
    expect(onStartDrag).not.toHaveBeenCalled();
    // Vertical pan past threshold on a horizontal numpad → drag
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 50,
    });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
    expect(onStartDrag).toHaveBeenCalledWith({
      digit: 3,
      x: 0,
      y: 50,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(onSkimDigit).not.toHaveBeenCalled();
  });

  it("legend switches to note-mode wording when a tap pencils notes", () => {
    // With a multi-cell selection active, a tap pencils notes (same as
    // hold) — "tap = enter" would promise the wrong thing at exactly
    // the moment the player is looking for confirmation of their
    // range. The legend follows the live tap action.
    const { rerender } = render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        tapAction="note"
      />,
    );
    expect(
      screen.getByText("tap = note · hold = note · drag = place"),
    ).toBeInTheDocument();

    // Selection cleared → back to the default wording.
    rerender(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        tapAction="enter"
      />,
    );
    expect(
      screen.getByText("tap = enter · hold = note · drag = place"),
    ).toBeInTheDocument();
  });

  it("renders digits as pencil-note previews while a tap will note", () => {
    // Pre-press affordance: with a range selected, each key shows its
    // digit as a small pencil mark in its 3×3 note-grid slot — the
    // numpad previews the exact artifact a press will create, instead
    // of a caption describing it. The accessible name says so too.
    const { rerender } = render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        tapAction="note"
      />,
    );
    const noteKey = screen.getByRole("button", { name: "5, pencil note" });
    expect(noteKey.querySelector("[data-note-preview]")).not.toBeNull();

    // Back to enter-mode: full-size digit, remaining count, no preview.
    rerender(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        tapAction="enter"
      />,
    );
    const valueKey = screen.getByRole("button", { name: "5, 9 remaining" });
    expect(valueKey.querySelector("[data-note-preview]")).toBeNull();
  });

  it("keeps an off-center click with slight wobble a tap", () => {
    // Desktop bug: gesture slop was measured from the BUTTON CENTER,
    // so on a 64px button any click landing >12px off-center (~87% of
    // its area) was "past the threshold" before the pointer moved at
    // all — 3px of natural mouse wobble then misfired a skim or drag
    // and swallowed the tap.
    const onTapNumber = vi.fn();
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={onTapNumber}
        onHoldNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const five = screen.getByRole("button", { name: /^5, / });
    mockRect(five, {
      left: 0,
      top: 0,
      right: 64,
      bottom: 64,
      width: 64,
      height: 64,
    });
    // Press near the button's right edge, 24px from its center...
    fireEvent.pointerDown(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 56,
      clientY: 40,
    });
    // ...then wobble 3px — far under the 12px gesture slop.
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
    expect(onStartDrag).not.toHaveBeenCalled();
    expect(onSkimDigit).not.toHaveBeenCalled();
    expect(onTapNumber).toHaveBeenCalledWith(5);
  });

  it("classifies drag direction from the movement, not the press position", () => {
    // A perpendicular pull toward the board must read as a drag even
    // when the press landed off-center — with the old center-relative
    // origin, the click position dominated the angle and an upward
    // 20px pull from a right-edge press was misread as a skim.
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const five = screen.getByRole("button", { name: /^5, / });
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
    // Straight-up 20px pull: perpendicular to a bottom numpad → drag.
    fireEvent.pointerMove(five, {
      pointerType: "mouse",
      pointerId: 1,
      clientX: 56,
      clientY: 20,
    });
    expect(onSkimDigit).not.toHaveBeenCalled();
    expect(onStartDrag).toHaveBeenCalledWith({
      digit: 5,
      x: 56,
      y: 20,
      pointerId: 1,
      pointerType: "mouse",
    });
  });

  it("falls back to drag for any direction when no skim handler is wired", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onStartDrag={onStartDrag}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 50,
      clientY: 0,
    });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
  });

  function hasAccent(el: HTMLElement) {
    return el.classList.contains("bg-accent");
  }

  it("transfers the press visual to the digit currently under the finger during skim", () => {
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        selectedValue={null}
        onTapNumber={vi.fn()}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    const five = screen.getByRole("button", { name: /^5, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // During press, the original digit reads as visually accented.
    expect(hasAccent(three)).toBe(true);
    expect(hasAccent(five)).toBe(false);

    // Pan along-axis past threshold → skim mode
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    // Finger crosses into digit 5
    mockElementFromPoint(five);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    // The press visual must follow the finger — the original digit lets
    // go, the new one picks up.
    expect(hasAccent(three)).toBe(false);
    expect(hasAccent(five)).toBe(true);
  });

  it("clears the press visual on release", () => {
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        selectedValue={null}
        onTapNumber={vi.fn()}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    expect(hasAccent(three)).toBe(true);
    fireEvent.pointerUp(three, { pointerType: "touch", pointerId: 1 });
    expect(hasAccent(three)).toBe(false);
  });

  it("does not start a drag when the pan is along the numpad axis", () => {
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Horizontal pan past threshold on a horizontal numpad → skim, not drag
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    expect(onStartDrag).not.toHaveBeenCalled();
  });

  it("treats a shallow diagonal pan as a skim, outside the drag cone", () => {
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // A pan ~37° off the board-facing axis sits outside the 60° drag
    // cone — diagonal enough to read as an along-axis skim, not a drag.
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 30, clientY: 40 });
    expect(onStartDrag).not.toHaveBeenCalled();
  });

  it("fires onSkimDigit when the finger crosses into a different digit", () => {
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={vi.fn()}
        onStartDrag={vi.fn()}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    const five = screen.getByRole("button", { name: /^5, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Cross the threshold along the axis → skim mode armed
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    // Still on the original digit — no transition yet
    expect(onSkimDigit).not.toHaveBeenCalled();

    // Finger now over digit 5
    mockElementFromPoint(five);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    expect(onSkimDigit).toHaveBeenCalledTimes(1);
    expect(onSkimDigit).toHaveBeenCalledWith(5);
  });

  it("does not refire onSkimDigit for the same digit on every move", () => {
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    const five = screen.getByRole("button", { name: /^5, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    mockElementFromPoint(five);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 110, clientY: 0 }),
      );
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 120, clientY: 0 }),
      );
    });
    expect(onSkimDigit).toHaveBeenCalledTimes(1);
  });

  it("fires onPressEnd when a skim gesture is released", () => {
    const onPressEnd = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onPressEnd={onPressEnd}
        onSkimDigit={vi.fn()}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    // Skim mode is active; the document handles the release.
    act(() => {
      document.dispatchEvent(docPointer("pointerup", { pointerId: 1 }));
    });
    expect(onPressEnd).toHaveBeenCalled();
  });

  it("does not fire onSkimDigit when the finger drifts over a disabled (completed) digit", () => {
    const onSkimDigit = vi.fn();
    // 5 is complete (0 remaining) so its button will be disabled.
    const remaining = { ...ZERO_REMAINING, 5: 0 };
    render(
      <NumPad
        position="bottom"
        remainingCounts={remaining}
        onTapNumber={vi.fn()}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    // The completed 5 is visually invisible but still present in the DOM.
    const five = document.querySelector(
      '[data-numpad-digit="5"]',
    ) as HTMLButtonElement;
    expect(five.disabled).toBe(true);
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    mockElementFromPoint(five);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    expect(onSkimDigit).not.toHaveBeenCalled();
  });

  it("classifies along-axis as the Y axis when the numpad is vertical", () => {
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="right"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Vertical pan = along-axis for a vertical numpad → no drag
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 0, clientY: 50 });
    expect(onStartDrag).not.toHaveBeenCalled();
    expect(onSkimDigit).not.toHaveBeenCalled(); // still on original digit
  });

  it("cancels the hold timer once a drag begins", () => {
    const onHoldNumber = vi.fn();
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onHoldNumber={onHoldNumber}
        onStartDrag={onStartDrag}
      />,
    );
    const five = screen.getByRole("button", { name: /^5, / });
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
    expect(onHoldNumber).not.toHaveBeenCalled();
  });

  it("only starts the drag once per press", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={onStartDrag}
      />,
    );
    const nine = screen.getByRole("button", { name: /^9, / });
    fireEvent.pointerDown(nine, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(nine, { pointerId: 1, clientX: 50, clientY: 0 });
    fireEvent.pointerMove(nine, { pointerId: 1, clientX: 100, clientY: 0 });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
  });

  it("promotes a skim into a drag when the finger pulls off the numpad toward the board", () => {
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={onSkimDigit}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    const five = screen.getByRole("button", { name: /^5, / });
    // Numpad button row spans y∈[0,80]; the board sits above (y<0).
    mockRect(screen.getByRole("group", { name: "Number pad" }), {
      top: 0,
      bottom: 80,
      left: 0,
      right: 300,
    });
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    // Pan along-axis past threshold → skim mode armed.
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 80,
      clientY: 20,
    });
    // Finger skims onto digit 5 while still over the numpad row.
    mockElementFromPoint(five);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 140, clientY: 20 }),
      );
    });
    expect(onSkimDigit).toHaveBeenLastCalledWith(5);
    expect(onStartDrag).not.toHaveBeenCalled();
    // Finger lifts off the numpad toward the board → drag-to-place,
    // carrying the skimmed digit (5), not the pressed one (3).
    mockElementFromPoint(null);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 140, clientY: -10 }),
      );
    });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
    expect(onStartDrag).toHaveBeenCalledWith({
      digit: 5,
      x: 140,
      y: -10,
      pointerId: 1,
      pointerType: "touch",
    });
  });

  it("does not promote a skim into a drag when the finger slides off the numpad's end", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={vi.fn()}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    mockRect(screen.getByRole("group", { name: "Number pad" }), {
      top: 0,
      bottom: 80,
      left: 0,
      right: 300,
    });
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
    mockElementFromPoint(null);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 360, clientY: 20 }),
      );
    });
    expect(onStartDrag).not.toHaveBeenCalled();
  });

  it("resumes a live skim when a drag returns via resumeSkimFromDrag", () => {
    const onSkimDigit = vi.fn();
    const ref = createRef<NumPadHandle>();
    render(
      <NumPad
        ref={ref}
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        selectedValue={null}
        onTapNumber={vi.fn()}
        onSkimDigit={onSkimDigit}
      />,
    );
    const five = screen.getByRole("button", { name: /^5, / });
    const seven = screen.getByRole("button", { name: /^7, / });
    // A returning drag handed digit 5 back: highlight it and re-arm the
    // skim under the same pointer.
    act(() => {
      ref.current?.resumeSkimFromDrag({
        digit: 5,
        pointerId: 1,
        pointerType: "touch",
      });
    });
    expect(onSkimDigit).toHaveBeenCalledWith(5);
    expect(hasAccent(five)).toBe(true);
    // The skim is live — sliding the finger onto digit 7 highlights it.
    mockElementFromPoint(seven);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 100, clientY: 0 }),
      );
    });
    expect(onSkimDigit).toHaveBeenLastCalledWith(7);
    expect(hasAccent(seven)).toBe(true);
  });

  it("promotes a skim into a drag on a vertical numpad when the finger pulls toward the board", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="right"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={onStartDrag}
        onSkimDigit={vi.fn()}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    const five = screen.getByRole("button", { name: /^5, / });
    // Right numpad column spans x∈[0,60]; the board sits to the left.
    mockRect(screen.getByRole("group", { name: "Number pad" }), {
      top: 0,
      bottom: 600,
      left: 0,
      right: 60,
    });
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
    mockElementFromPoint(five);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: 10, clientY: 140 }),
      );
    });
    expect(onStartDrag).not.toHaveBeenCalled();
    // Finger pulls left toward the board, off the numpad column.
    mockElementFromPoint(null);
    act(() => {
      document.dispatchEvent(
        docPointer("pointermove", { pointerId: 1, clientX: -20, clientY: 140 }),
      );
    });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
    expect(onStartDrag).toHaveBeenCalledWith({
      digit: 5,
      x: -20,
      y: 140,
      pointerId: 1,
      pointerType: "touch",
    });
  });
});

describe("NumPad cursor affordance", () => {
  it("carries the grab cursor on the key group, not only on the keys", () => {
    // The gaps between keys belong to the group element, so a bare
    // group drops the pointer back to the default arrow between every
    // key the pointer crosses.
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onTapNumber={vi.fn()}
        onStartDrag={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Number pad" }).className,
    ).toContain("cursor-grab");
  });
});
