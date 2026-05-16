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

  it("fires onNumber on tap", () => {
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
    expect(onNumber).toHaveBeenCalledWith(7);
  });

  it("fires onLongPressNumber after holding, and suppresses tap", () => {
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
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPressNumber).toHaveBeenCalledWith(4);
    fireEvent.pointerUp(four, { pointerType: "touch" });
    fireEvent.click(four);
    expect(onNumber).not.toHaveBeenCalled();
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
    vi.advanceTimersByTime(200);
    fireEvent.pointerUp(two, { pointerType: "touch" });
    fireEvent.click(two);
    expect(onLongPressNumber).not.toHaveBeenCalled();
    expect(onNumber).toHaveBeenCalledWith(2);
  });

  it("cancels long-press if pointer leaves the button", () => {
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
    const six = screen.getByRole("button", { name: /^6, / });
    fireEvent.pointerDown(six, { pointerType: "touch" });
    fireEvent.pointerLeave(six);
    vi.advanceTimersByTime(500);
    expect(onLongPressNumber).not.toHaveBeenCalled();
  });

  it("flags the pressed digit with the charge animation while holding", () => {
    const onLongPressNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={onLongPressNumber}
      />,
    );
    const three = screen.getByRole("button", { name: /^3, / });
    expect(three.className).not.toContain("animate-longpress-charge");

    fireEvent.pointerDown(three, { pointerType: "touch" });
    expect(three.className).toContain("animate-longpress-charge");

    fireEvent.pointerUp(three, { pointerType: "touch" });
    expect(three.className).not.toContain("animate-longpress-charge");
  });

  it("clears the charge animation after long-press fires", () => {
    const onLongPressNumber = vi.fn();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
        onLongPressNumber={onLongPressNumber}
      />,
    );
    const nine = screen.getByRole("button", { name: /^9, / });
    fireEvent.pointerDown(nine, { pointerType: "touch" });
    expect(nine.className).toContain("animate-longpress-charge");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPressNumber).toHaveBeenCalledWith(9);
    expect(nine.className).not.toContain("animate-longpress-charge");
  });

  it("does not start charging when long-press is disabled", () => {
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        onNumber={vi.fn()}
      />,
    );
    const five = screen.getByRole("button", { name: /^5, / });
    fireEvent.pointerDown(five, { pointerType: "touch" });
    expect(five.className).not.toContain("animate-longpress-charge");
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
});
