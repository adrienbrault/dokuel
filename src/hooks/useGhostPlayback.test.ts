import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GhostSample } from "../lib/types.ts";
import { useGhostPlayback } from "./useGhostPlayback.ts";

const samples: GhostSample[] = [
  { t: 0, p: 0 },
  { t: 10, p: 50 },
  { t: 20, p: 100 },
];

describe("useGhostPlayback", () => {
  it("interpolates the ghost percent at the elapsed time", () => {
    const { result } = renderHook(() =>
      useGhostPlayback({ samples, elapsedSeconds: 5 }),
    );
    expect(result.current.ghostPercent).toBe(25);
  });

  it("reports the ghost as unfinished before the last sample", () => {
    const { result } = renderHook(() =>
      useGhostPlayback({ samples, elapsedSeconds: 12 }),
    );
    expect(result.current.ghostFinished).toBe(false);
  });

  it("reports the ghost as finished at and after the last sample", () => {
    const { result, rerender } = renderHook(
      (props: { elapsedSeconds: number }) =>
        useGhostPlayback({ samples, elapsedSeconds: props.elapsedSeconds }),
      { initialProps: { elapsedSeconds: 20 } },
    );
    expect(result.current.ghostFinished).toBe(true);
    expect(result.current.ghostPercent).toBe(100);

    rerender({ elapsedSeconds: 35 });
    expect(result.current.ghostFinished).toBe(true);
    expect(result.current.ghostPercent).toBe(100);
  });
});
