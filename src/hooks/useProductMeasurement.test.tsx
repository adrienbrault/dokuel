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

it("counts distinct daily entries and a home visit while ignoring configuration screens", () => {
  vi.mocked(trackProductEvent).mockClear();
  const { rerender } = renderHook(
    ({ screen }: { screen: Screen }) => useProductMeasurement(screen),
    { initialProps: { screen: { name: "landing" } } },
  );
  rerender({ screen: { name: "difficulty", mode: "solo" } });
  rerender({ screen: { name: "landing" } });
  rerender({ screen: { name: "daily", date: "2026-09-01" } });
  rerender({ screen: { name: "daily", date: "2026-09-01" } });
  rerender({ screen: { name: "daily", date: "2026-09-02" } });
  expect(trackProductEvent).toHaveBeenCalledTimes(3);
  expect(trackProductEvent).toHaveBeenNthCalledWith(1, "visit");
  expect(trackProductEvent).toHaveBeenLastCalledWith("game_start", "daily");
});
