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
});
