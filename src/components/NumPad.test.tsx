import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumPad } from "./NumPad.tsx";

const ZERO_REMAINING = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };

describe("NumPad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
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

  it("fires both onNumber (on press) and onLongPressNumber (at 400ms)", () => {
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
    vi.advanceTimersByTime(200);
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

  it("starts a drag once the pointer slides past the drag threshold", () => {
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
    // Small drift — under threshold
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 4, clientY: 4 });
    expect(onStartDrag).not.toHaveBeenCalled();
    // Push past 12px threshold
    fireEvent.pointerMove(three, { pointerId: 1, clientX: 50, clientY: 0 });
    expect(onStartDrag).toHaveBeenCalledTimes(1);
    expect(onStartDrag).toHaveBeenCalledWith({
      digit: 3,
      x: 50,
      y: 0,
      pointerId: 1,
    });
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
});
