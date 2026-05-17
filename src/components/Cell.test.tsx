import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cell as CellType } from "../lib/types.ts";
import { Cell } from "./Cell.tsx";

function makeCell(overrides: Partial<CellType> = {}): CellType {
  return {
    value: null,
    isGiven: false,
    notes: new Set(),
    ...overrides,
  };
}

function defaultProps() {
  return {
    row: 0,
    col: 0,
    isSelected: false,
    isMultiSelected: false,
    isHighlighted: false,
    isSameNumber: false,
    isConflict: false,
    onSelect: vi.fn(),
  };
}

describe("Cell chargingDigit", () => {
  it("renders the charging glyph as an overlay when chargingDigit is set", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell({ notes: new Set([7]) })}
        chargingDigit={7}
      />,
    );
    expect(screen.getByTestId("note-charge")).toBeInTheDocument();
    expect(screen.getByTestId("note-charge")).toHaveTextContent("7");
  });

  it("renders the charging glyph for the held digit even if the note isn't in the cell yet", () => {
    // Race: pointerdown fires onNumber but the parent's setChargingDigit
    // may render before the cell has propagated its new notes set.
    render(<Cell {...defaultProps()} cell={makeCell()} chargingDigit={4} />);
    expect(screen.getByTestId("note-charge")).toHaveTextContent("4");
  });

  it("omits the charging glyph when chargingDigit is undefined", () => {
    render(
      <Cell {...defaultProps()} cell={makeCell({ notes: new Set([7]) })} />,
    );
    expect(screen.queryByTestId("note-charge")).toBeNull();
  });

  it("omits the charging glyph when the cell already shows a value", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell({ value: 7, isGiven: false })}
        chargingDigit={7}
      />,
    );
    expect(screen.queryByTestId("note-charge")).toBeNull();
  });

  it("starts the animation at the note-grid position of the held digit", () => {
    // digit 1 sits in the top-left sub-cell — animation should start
    // offset to the top-left (negative dx, negative dy).
    const { rerender } = render(
      <Cell
        {...defaultProps()}
        cell={makeCell({ notes: new Set([1]) })}
        chargingDigit={1}
      />,
    );
    expect(
      screen.getByTestId("note-charge").style.getPropertyValue("--charge-dx"),
    ).toContain("-");
    expect(
      screen.getByTestId("note-charge").style.getPropertyValue("--charge-dy"),
    ).toContain("-");

    // digit 5 is the center sub-cell — no offset.
    rerender(
      <Cell
        {...defaultProps()}
        cell={makeCell({ notes: new Set([5]) })}
        chargingDigit={5}
      />,
    );
    expect(
      screen.getByTestId("note-charge").style.getPropertyValue("--charge-dx"),
    ).toBe("0%");
    expect(
      screen.getByTestId("note-charge").style.getPropertyValue("--charge-dy"),
    ).toBe("0%");

    // digit 9 is bottom-right — both offsets positive.
    rerender(
      <Cell
        {...defaultProps()}
        cell={makeCell({ notes: new Set([9]) })}
        chargingDigit={9}
      />,
    );
    expect(
      Number.parseFloat(
        screen.getByTestId("note-charge").style.getPropertyValue("--charge-dx"),
      ),
    ).toBeGreaterThan(0);
    expect(
      Number.parseFloat(
        screen.getByTestId("note-charge").style.getPropertyValue("--charge-dy"),
      ),
    ).toBeGreaterThan(0);
  });

  it("hides the static note glyph for the digit being charged", () => {
    // Notes 1, 3, 5 in the cell; charging digit 3 — only 1 and 5
    // should remain visible in the notes grid (the 3 is being shown
    // by the moving charge overlay instead).
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell({ notes: new Set([1, 3, 5]) })}
        chargingDigit={3}
      />,
    );
    const grid = screen
      .getByTestId("note-charge")
      .parentElement?.querySelector(".grid");
    expect(grid?.textContent).toBe("15");
  });
});
