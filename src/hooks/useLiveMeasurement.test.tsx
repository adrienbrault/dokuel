import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useLiveMeasurement } from "./useLiveMeasurement.ts";
vi.mock("../lib/product-events.ts", () => ({ trackProductEvent: vi.fn() }));
import { trackProductEvent } from "../lib/product-events.ts";

it("counts a live start after countdown and completion only after the local solve", () => {
  const { rerender } = renderHook(({ countdown, completedAt }) => useLiveMeasurement("room", "me", { gameNumber: 1, startedAt: 1000, results: completedAt ? { me: { completedAt, board: "verified" } } : {} }, countdown), { initialProps: { countdown: 3, completedAt: 0 } });
  expect(trackProductEvent).not.toHaveBeenCalled();
  rerender({ countdown: 0, completedAt: 0 });
  expect(trackProductEvent).toHaveBeenCalledExactlyOnceWith("game_start", "live");
  rerender({ countdown: 0, completedAt: 41000 });
  rerender({ countdown: 0, completedAt: 41000 });
  expect(trackProductEvent).toHaveBeenCalledTimes(2);
  expect(trackProductEvent).toHaveBeenLastCalledWith("game_complete", "live", 40);
});
