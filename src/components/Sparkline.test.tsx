// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./Sparkline.tsx";

describe("Sparkline", () => {
  it("renders an SVG with a polyline", () => {
    const { container } = render(
      <Sparkline times={[100, 80, 120, 90]} width={120} height={40} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });

  it("renders nothing with fewer than 2 data points", () => {
    const { container } = render(
      <Sparkline times={[100]} width={120} height={40} />,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("highlights the latest point with a circle", () => {
    const { container } = render(
      <Sparkline times={[100, 80, 120]} width={120} height={40} />,
    );
    expect(container.querySelector("circle")).toBeInTheDocument();
  });
});
