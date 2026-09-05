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

  it("does not lose elapsed time while checkpointing fractional progress", () => {
    let now = 1_000;
    const samples: number[] = [];
    const elapsed = createElapsedClock({
      now: () => {
        samples.push(now);
        return now++;
      },
    });

    elapsed.start();
    elapsed.checkpoint();
    const current = elapsed.elapsed();
    const first = samples[0] ?? 0;
    const last = samples.at(-1) ?? 0;

    expect(current).toBe((last - first) / 1_000);
  });

  it("preserves fractional active time across a pause and resume", () => {
    let now = 1_000;
    const elapsed = createElapsedClock({ now: () => now });

    elapsed.start();
    now += 1_250.5;
    expect(elapsed.pause()).toBe(1.2505);

    now += 10_000;
    elapsed.resume();
    now += 749.75;

    expect(elapsed.finalize()).toBe(2.00025);
    now += 5_000;
    expect(elapsed.elapsed()).toBe(2.00025);
  });

  it("waits for a future shared start anchor", () => {
    let now = 1_000;
    const elapsed = createElapsedClock({
      now: () => now,
      startAt: 3_000,
    });

    elapsed.start();
    now = 2_000;
    expect(elapsed.elapsed()).toBe(0);
    now = 3_500;
    expect(elapsed.elapsed()).toBe(0.5);
    expect(elapsed.checkpoint()).toBe(0.5);
  });
});
