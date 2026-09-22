import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING_DEMO_SCRIPT } from "../lib/landing-demo.ts";
import { LandingDemo } from "./LandingDemo.tsx";

const FIRST = LANDING_DEMO_SCRIPT[0]!;
const SECOND = LANDING_DEMO_SCRIPT[1]!;
const LOOP_MS = LANDING_DEMO_SCRIPT.reduce((sum, step) => sum + step.ms, 0);

function caption() {
  return screen.getByTestId("landing-demo-caption").textContent;
}

describe("LandingDemo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the script step by step and loops back to the start", () => {
    render(<LandingDemo />);

    expect(caption()).toBe(FIRST.caption);
    act(() => {
      vi.advanceTimersByTime(FIRST.ms);
    });
    expect(caption()).toBe(SECOND.caption);
    act(() => {
      vi.advanceTimersByTime(LOOP_MS - FIRST.ms);
    });
    expect(caption()).toBe(FIRST.caption);
  });
});
