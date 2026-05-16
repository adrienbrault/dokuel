import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demo } from "../../lib/guides/builders.ts";
import { TechniqueDemo } from "./TechniqueDemo.tsx";

const EMPTY_PUZZLE = ".".repeat(81);

const TWO_STEP_DEMO = demo("d", "Demo")
  .puzzle(EMPTY_PUZZLE)
  .step("First caption.")
  .step("Second caption.")
  .build();

describe("TechniqueDemo", () => {
  it("shows the first step's caption on mount", () => {
    render(<TechniqueDemo demo={TWO_STEP_DEMO} />);
    expect(screen.getByText("First caption.")).toBeDefined();
  });

  it("advances to the next step when Next is clicked", () => {
    render(<TechniqueDemo demo={TWO_STEP_DEMO} />);
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    expect(screen.getByText("Second caption.")).toBeDefined();
  });

  describe("with fake timers", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("auto-advances when playing", () => {
      render(<TechniqueDemo demo={TWO_STEP_DEMO} />);
      expect(screen.getByText("First caption.")).toBeDefined();
      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(screen.getByText("Second caption.")).toBeDefined();
    });

    it("does not auto-advance when paused", () => {
      render(<TechniqueDemo demo={TWO_STEP_DEMO} />);
      fireEvent.click(screen.getByRole("button", { name: /pause/i }));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText("First caption.")).toBeDefined();
    });

    it("respects prefers-reduced-motion by not auto-advancing", () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      })) as typeof window.matchMedia;
      try {
        render(<TechniqueDemo demo={TWO_STEP_DEMO} />);
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(screen.getByText("First caption.")).toBeDefined();
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });
});
