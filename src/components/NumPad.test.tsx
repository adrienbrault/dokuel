import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumPad } from "./NumPad.tsx";

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

  it("fires onNumber on pointerdown (instant note feedback)", () => {
    const onNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={onNumber}
      />,
    );
    const seven = screen.getByRole("button", { name: /^7, / });
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    // Don't need to wait for click — pointerdown is enough.
    expect(onNumber).toHaveBeenCalledTimes(1);
    expect(onNumber).toHaveBeenCalledWith(7);
  });

  it("does not double-fire onNumber when click follows pointerdown", () => {
    const onNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={onNumber}
      />,
    );
    const seven = screen.getByRole("button", { name: /^7, / });
    fireEvent.pointerDown(seven, { pointerType: "touch" });
    fireEvent.pointerUp(seven, { pointerType: "touch" });
    fireEvent.click(seven);
    expect(onNumber).toHaveBeenCalledTimes(1);
  });

  it("fires onNumber on click without pointer (keyboard activation)", () => {
    const onNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={onNumber}
      />,
    );
    const seven = screen.getByRole("button", { name: /^7, / });
    fireEvent.click(seven);
    expect(onNumber).toHaveBeenCalledWith(7);
  });

  it("fires both onNumber (on press) and onLongPressNumber (at 200ms)", () => {
    const onNumber = vi.fn();
    const onLongPressNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={onNumber}
        onLongPressNumber={onLongPressNumber}
      />,
    );
    const four = screen.getByRole("button", { name: /^4, / });
    fireEvent.pointerDown(four, { pointerType: "touch" });
    expect(onNumber).toHaveBeenCalledWith(4);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPressNumber).toHaveBeenCalledWith(4);
    fireEvent.pointerUp(four, { pointerType: "touch" });
    fireEvent.click(four);
    // onNumber still only called once (from pointerdown), not from click
    expect(onNumber).toHaveBeenCalledTimes(1);
  });

  it("does not fire long-press if released early", () => {
    const onNumber = vi.fn();
    const onLongPressNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={onNumber}
        onLongPressNumber={onLongPressNumber}
      />,
    );
    const two = screen.getByRole("button", { name: /^2, / });
    fireEvent.pointerDown(two, { pointerType: "touch" });
    expect(onNumber).toHaveBeenCalledWith(2);
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(two, { pointerType: "touch" });
    fireEvent.click(two);
    expect(onLongPressNumber).not.toHaveBeenCalled();
    expect(onNumber).toHaveBeenCalledTimes(1);
  });

  it("cancels long-press if pointer leaves the button", () => {
    const onLongPressNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={onLongPressNumber}
      />,
    );
    const six = screen.getByRole("button", { name: /^6, / });
    fireEvent.pointerDown(six, { pointerType: "touch" });
    fireEvent.pointerLeave(six);
    vi.advanceTimersByTime(500);
    expect(onLongPressNumber).not.toHaveBeenCalled();
  });

  it("calls onPressEnd on pointer release (after early tap)", () => {
    const onPressEnd = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
        onPressEnd={onPressEnd}
      />,
    );
    const eight = screen.getByRole("button", { name: /^8, / });
    fireEvent.pointerDown(eight, { pointerType: "touch" });
    expect(onPressEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(eight, { pointerType: "touch" });
    expect(onPressEnd).toHaveBeenCalledTimes(1);
  });

  it("calls onPressEnd after long-press fires (on release)", () => {
    const onPressEnd = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
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
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
      />,
    );
    expect(screen.getByText(/tap = note · hold = enter/i)).toBeInTheDocument();
  });

  it("starts a drag when the pan is perpendicular to the numpad axis", () => {
    const onStartDrag = vi.fn();
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
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

  it("falls back to drag for any direction when no skim handler is wired", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
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
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
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

  it("fires onSkimDigit when the finger crosses into a different digit", () => {
    const onSkimDigit = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={vi.fn()}
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
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
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

  it("cancels the long-press timer once a drag begins", () => {
    const onLongPressNumber = vi.fn();
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={onLongPressNumber}
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
    expect(onLongPressNumber).not.toHaveBeenCalled();
  });

  it("only starts the drag once per press", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
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
        onNumber={vi.fn()}
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

  it("promotes a skim into a drag on a vertical numpad when the finger pulls toward the board", () => {
    const onStartDrag = vi.fn();
    render(
      <NumPad
        position="right"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
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
