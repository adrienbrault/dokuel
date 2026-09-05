import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HintBanner } from "./HintBanner.tsx";

describe("HintBanner", () => {
  it("titles a placement hint with its technique", () => {
    render(
      <HintBanner
        hint={{
          kind: "placement",
          position: { row: 0, col: 0 },
          value: 5,
          technique: "hidden-single",
          explanation: "In row 1, 5 can only go here.",
          relatedCells: [],
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Hidden Single")).toBeInTheDocument();
    expect(
      screen.getByText("In row 1, 5 can only go here."),
    ).toBeInTheDocument();
  });

  it("reads an elimination hint the same way, technique then prose", () => {
    render(
      <HintBanner
        hint={{
          kind: "elimination",
          position: { row: 2, col: 4 },
          technique: "locked-candidates",
          explanation:
            "In box 1, every place for 4 sits in row 3. Rub out the 4 in r3c5.",
          digits: [4],
          eliminatedCells: [{ row: 2, col: 4 }],
          relatedCells: [{ row: 2, col: 0 }],
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("Locked Candidates")).toBeInTheDocument();
    expect(screen.getByText(/Rub out the 4 in r3c5/)).toBeInTheDocument();
  });

  it("dismisses on request", async () => {
    const onDismiss = vi.fn();
    render(
      <HintBanner
        hint={{
          kind: "elimination",
          position: { row: 0, col: 1 },
          technique: "note-conflict",
          explanation: "The 5 pencilled in r1c2 already sits in row 1.",
          digits: [5],
          eliminatedCells: [{ row: 0, col: 1 }],
          relatedCells: [{ row: 0, col: 0 }],
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Impossible Note")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
