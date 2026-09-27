import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBoard3DEnabled,
  setBoard3DEnabled,
  subscribeBoard3D,
} from "./board-3d.ts";

afterEach(() => {
  localStorage.clear();
});

describe("3D board preference", () => {
  it("is on until the player turns it off", () => {
    expect(getBoard3DEnabled()).toBe(true);
    setBoard3DEnabled(false);
    expect(getBoard3DEnabled()).toBe(false);
  });

  it("survives a reload", () => {
    setBoard3DEnabled(false);
    expect(localStorage.getItem("sudoku_board_3d")).toBe("off");
  });

  it("tells every mounted listener when it changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBoard3D(listener);
    setBoard3DEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setBoard3DEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
