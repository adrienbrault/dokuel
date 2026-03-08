import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboard } from "./useKeyboard.ts";

function setup(overrides: Partial<Parameters<typeof useKeyboard>[0]> = {}) {
  const options = {
    selectedCell: { row: 4, col: 4 } as { row: number; col: number } | null,
    onSelectCell: vi.fn(),
    onPlaceNumber: vi.fn(),
    onErase: vi.fn(),
    onUndo: vi.fn(),
    onToggleNotes: vi.fn(),
    enabled: true,
    ...overrides,
  };
  renderHook(() => useKeyboard(options));
  return options;
}

describe("useKeyboard", () => {
  it("calls onPlaceNumber for keys 1-9", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "5" });
    expect(opts.onPlaceNumber).toHaveBeenCalledWith(5);
  });

  it("calls onPlaceNumber for all digits", () => {
    const opts = setup();
    for (let i = 1; i <= 9; i++) {
      fireEvent.keyDown(window, { key: String(i) });
    }
    expect(opts.onPlaceNumber).toHaveBeenCalledTimes(9);
  });

  it("navigates up with ArrowUp", () => {
    const opts = setup({ selectedCell: { row: 4, col: 4 } });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(3, 4);
  });

  it("navigates down with ArrowDown", () => {
    const opts = setup({ selectedCell: { row: 4, col: 4 } });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(5, 4);
  });

  it("navigates left with ArrowLeft", () => {
    const opts = setup({ selectedCell: { row: 4, col: 4 } });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(4, 3);
  });

  it("navigates right with ArrowRight", () => {
    const opts = setup({ selectedCell: { row: 4, col: 4 } });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(4, 5);
  });

  it("clamps at top edge", () => {
    const opts = setup({ selectedCell: { row: 0, col: 4 } });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(0, 4);
  });

  it("clamps at bottom edge", () => {
    const opts = setup({ selectedCell: { row: 8, col: 4 } });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(8, 4);
  });

  it("clamps at left edge", () => {
    const opts = setup({ selectedCell: { row: 4, col: 0 } });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(4, 0);
  });

  it("clamps at right edge", () => {
    const opts = setup({ selectedCell: { row: 4, col: 8 } });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(4, 8);
  });

  it("selects center cell when arrow pressed with no selection", () => {
    const opts = setup({ selectedCell: null });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(opts.onSelectCell).toHaveBeenCalledWith(4, 4);
  });

  it("calls onErase for Delete key", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(opts.onErase).toHaveBeenCalled();
  });

  it("calls onErase for Backspace key", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(opts.onErase).toHaveBeenCalled();
  });

  it("calls onToggleNotes for n key", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "n" });
    expect(opts.onToggleNotes).toHaveBeenCalled();
  });

  it("calls onToggleNotes for N key", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "N" });
    expect(opts.onToggleNotes).toHaveBeenCalled();
  });

  it("calls onUndo for Ctrl+Z", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(opts.onUndo).toHaveBeenCalled();
  });

  it("calls onUndo for Cmd+Z", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(opts.onUndo).toHaveBeenCalled();
  });

  it("ignores all keys when disabled", () => {
    const opts = setup({ enabled: false });
    fireEvent.keyDown(window, { key: "5" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.keyDown(window, { key: "n" });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(opts.onPlaceNumber).not.toHaveBeenCalled();
    expect(opts.onSelectCell).not.toHaveBeenCalled();
    expect(opts.onErase).not.toHaveBeenCalled();
    expect(opts.onToggleNotes).not.toHaveBeenCalled();
    expect(opts.onUndo).not.toHaveBeenCalled();
  });

  it("ignores unhandled keys", () => {
    const opts = setup();
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "0" });
    expect(opts.onPlaceNumber).not.toHaveBeenCalled();
    expect(opts.onSelectCell).not.toHaveBeenCalled();
    expect(opts.onErase).not.toHaveBeenCalled();
    expect(opts.onToggleNotes).not.toHaveBeenCalled();
    expect(opts.onUndo).not.toHaveBeenCalled();
  });
});
