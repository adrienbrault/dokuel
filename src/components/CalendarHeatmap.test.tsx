import { describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";
import { CalendarHeatmap } from "./CalendarHeatmap.tsx";

describe("CalendarHeatmap", () => {
  it("renders the correct number of day cells", () => {
    const { container } = render(
      <CalendarHeatmap data={new Map()} days={90} />,
    );
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(90);
  });

  it("renders active dates with higher opacity", () => {
    const data = new Map([["2026-03-09", 3]]);
    const { container } = render(
      <CalendarHeatmap data={data} days={7} today="2026-03-09" />,
    );
    const rects = container.querySelectorAll("rect");
    // The last rect (today) should have opacity > 0
    const lastRect = rects[rects.length - 1]!;
    const opacity = lastRect.getAttribute("opacity");
    expect(Number(opacity)).toBeGreaterThan(0);
  });
});
