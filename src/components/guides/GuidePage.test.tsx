import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { demo } from "../../lib/guides/builders.ts";
import type { Guide } from "../../lib/guides/types.ts";
import { GuidePage } from "./GuidePage.tsx";

const EMPTY_PUZZLE = ".".repeat(81);

const STUB_GUIDE: Guide = {
  id: "scanning",
  title: "Scanning",
  level: "beginner",
  summary: "Look for forced placements.",
  sections: [
    {
      heading: "How it works",
      body: "Find digits that can only go in one place.",
    },
  ],
  demos: [demo("d1", "Demo 1").puzzle(EMPTY_PUZZLE).step("First.").build()],
};

describe("GuidePage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders the guide title and section content", () => {
    render(<GuidePage guide={STUB_GUIDE} onBack={() => {}} />);
    expect(screen.getByText("Scanning")).toBeDefined();
    expect(
      screen.getByText(/Find digits that can only go in one place/),
    ).toBeDefined();
  });

  it("marks the guide as viewed in localStorage on mount", () => {
    render(<GuidePage guide={STUB_GUIDE} onBack={() => {}} />);
    const stored = JSON.parse(
      localStorage.getItem("dokuel:guides:viewed") ?? "[]",
    );
    expect(stored).toContain("scanning");
  });
});
