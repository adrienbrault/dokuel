import { describe, expect, it } from "vitest";
import { createElapsedClock } from "./elapsed-clock.ts";

describe("createElapsedClock", () => {
  it("reports elapsed time from the clock when no tick callback has run", () => {
    let now = 1_000;
    const elapsed = createElapsedClock({ now: () => now });

    elapsed.start();
    now += 2_500.5;

    expect(elapsed.elapsed()).toBe(2.5005);
    expect(elapsed.checkpoint()).toBe(2.5005);
  });
});
