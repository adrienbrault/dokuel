import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Guide } from "../../lib/guides/types.ts";
import { GuidesScreen } from "./GuidesScreen.tsx";

function stub(id: Guide["id"], title: string, level: Guide["level"]): Guide {
  return {
    id,
    title,
    level,
    summary: `Summary for ${title}.`,
    sections: [],
    demos: [],
  };
}

const GUIDES: Guide[] = [
  stub("scanning", "Scanning", "beginner"),
  stub("naked-pairs", "Naked Pairs", "intermediate"),
  stub("x-wing", "X-Wing", "advanced"),
];

describe("GuidesScreen", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders every guide grouped by tier", () => {
    render(
      <GuidesScreen guides={GUIDES} onSelect={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText("Scanning")).toBeDefined();
    expect(screen.getByText("Naked Pairs")).toBeDefined();
    expect(screen.getByText("X-Wing")).toBeDefined();
  });

  it("calls onSelect with the guide id when a guide row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <GuidesScreen guides={GUIDES} onSelect={onSelect} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Naked Pairs/i }));
    expect(onSelect).toHaveBeenCalledWith("naked-pairs");
  });
});
