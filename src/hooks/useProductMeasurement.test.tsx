import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Screen } from "../lib/navigation.ts";
import { useProductMeasurement } from "./useProductMeasurement.ts";

vi.mock("../lib/product-events.ts", () => ({ trackProductEvent: vi.fn() }));

import { trackProductEvent } from "../lib/product-events.ts";

it("counts an attempt start once across rerenders", () => {
  const screen: Screen = {
    name: "solo",
    difficulty: "easy",
    gameKey: "attempt",
    assistLevel: "standard",
  };
  const { rerender } = renderHook(() => useProductMeasurement(screen));
  rerender();
  expect(trackProductEvent).toHaveBeenCalledExactlyOnceWith(
    "game_start",
    "solo",
  );
});
