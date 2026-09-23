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

  it("holds one still frame and lists every gesture under reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const { container } = render(<LandingDemo />);
    const cells = () =>
      [...container.querySelectorAll("[data-row]")].map((el) =>
        el.getAttribute("aria-label"),
      );
    const before = cells();

    act(() => {
      vi.advanceTimersByTime(LOOP_MS);
    });

    expect(cells()).toEqual(before);
    expect(screen.queryByTestId("landing-demo-caption")).toBeNull();
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "Tap fills in a number",
      "Hold pencils a note",
      "Slide the pad spots a digit",
      "Drag to a cell top half fills, bottom half notes",
    ]);
  });

  it("pauses while the tab is hidden and picks up where it left off", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    render(<LandingDemo />);

    hidden.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(LOOP_MS);
    });
    expect(caption()).toBe(FIRST.caption);

    hidden.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(FIRST.ms);
    });
    expect(caption()).toBe(SECOND.caption);
  });

  it("pauses while scrolled out of view", () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof report) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<LandingDemo />);

    act(() => {
      report([{ isIntersecting: false }]);
    });
    act(() => {
      vi.advanceTimersByTime(LOOP_MS);
    });
    expect(caption()).toBe(FIRST.caption);

    act(() => {
      report([{ isIntersecting: true }]);
    });
    act(() => {
      vi.advanceTimersByTime(FIRST.ms);
    });
    expect(caption()).toBe(SECOND.caption);
    vi.unstubAllGlobals();
  });
  it("fills the cell only once the finger has touched down on the key", async () => {
    // A real layout and animation clock, which jsdom lacks: the stage
    // measures, and each finger trip finishes when the test says so.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 100 }),
    );
    const trips: (() => void)[] = [];
    Element.prototype.animate = vi.fn(() => {
      let land = () => {};
      const finished = new Promise<void>((resolve) => {
        land = resolve;
      });
      trips.push(land);
      return { finished, cancel: () => {} } as unknown as Animation;
    });
    const { container } = render(<LandingDemo />);
    const tapped = () =>
      container
        .querySelector('[data-row="2"][data-col="0"]')
        ?.getAttribute("aria-label");
    await act(async () => {
      trips.shift()?.();
    });

    act(() => {
      vi.advanceTimersByTime(FIRST.ms);
    });
    expect(caption()).toBe(SECOND.caption);
    expect(tapped()).not.toContain("value 1");

    await act(async () => {
      trips.shift()?.();
    });
    expect(tapped()).toContain("value 1");
    // @ts-expect-error restoring jsdom's missing API
    delete Element.prototype.animate;
  });
});
