import { describe, expect, it, vi } from "vitest";
import { registerCellHitResolver, resolveCellHit } from "./pointer-cell.ts";

describe("resolveCellHit", () => {
  it("finds nothing while no board is registered", () => {
    expect(resolveCellHit(10, 10)).toBeNull();
  });

  it("returns the cell a registered board reports", () => {
    const resolver = vi.fn(() => ({ row: 3, col: 7, localY: 0.25 }));
    const unregister = registerCellHitResolver(resolver);

    expect(resolveCellHit(40, 80)).toEqual({ row: 3, col: 7, localY: 0.25 });
    expect(resolver).toHaveBeenCalledWith(40, 80);
    unregister();
  });

  it("stops using a resolver once it is unregistered", () => {
    const resolver = vi.fn(() => ({ row: 0, col: 0, localY: 0 }));
    const unregister = registerCellHitResolver(resolver);
    unregister();

    expect(resolveCellHit(1, 1)).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("prefers the most recently registered board", () => {
    // Overlapping boards - a landing demo under the live game - resolve
    // in favour of the one mounted last, which is the one on top.
    const first = registerCellHitResolver(() => ({
      row: 1,
      col: 1,
      localY: 0,
    }));
    registerCellHitResolver(() => ({ row: 8, col: 8, localY: 1 }));

    expect(resolveCellHit(5, 5)).toEqual({ row: 8, col: 8, localY: 1 });
    first();
  });

  it("ignores a board that reports no cell", () => {
    const below = registerCellHitResolver(() => ({
      row: 4,
      col: 4,
      localY: 0.5,
    }));
    registerCellHitResolver(() => null);

    expect(resolveCellHit(5, 5)).toEqual({ row: 4, col: 4, localY: 0.5 });
    below();
  });
});
