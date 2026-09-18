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

describe("Cell accessible state", () => {
  it("announces a conflict in the label, not just via color", () => {
    // The red background/text is invisible to screen readers and
    // ambiguous for colorblind players; the state must be in the name.
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell({ value: 5 })}
        isConflict={true}
      />,
    );
    expect(
      screen.getByLabelText("Cell row 1 column 1, value 5, conflict"),
    ).toBeInTheDocument();
  });

  it("marks conflicted digits with a wavy underline for colorblind players", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell({ value: 5 })}
        isConflict={true}
      />,
    );
    const digit = screen.getByText("5");
    expect(digit.className).toContain("decoration-wavy");
  });

  it("announces given digits as given", () => {
    render(
      <Cell {...defaultProps()} cell={makeCell({ value: 7, isGiven: true })} />,
    );
    expect(
      screen.getByLabelText("Cell row 1 column 1, value 7, given"),
    ).toBeInTheDocument();
  });

  it("announces pencil notes", () => {
    render(
      <Cell {...defaultProps()} cell={makeCell({ notes: new Set([4, 1]) })} />,
    );
    expect(
      screen.getByLabelText("Cell row 1 column 1, empty, notes 1 4"),
    ).toBeInTheDocument();
  });
});

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
    // Race: the hold places the note and sets chargingDigit, but the
    // parent may render before the cell has propagated its new notes set.
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

  it("disables browser touch gestures on the cell so iOS doesn't hijack edge drags as back-swipe", () => {
    // Per the Pointer Events spec, the effective touch-action for a touch
    // is the intersection with scrollable ancestors only — the Board grid
    // isn't scrollable, so its `touch-none` doesn't propagate down. The
    // Cell itself must declare `touch-none`, otherwise iOS Safari treats
    // a horizontal drag from a left-edge cell as the system back gesture.
    render(<Cell {...defaultProps()} cell={makeCell({ value: 5 })} />);
    expect(screen.getByRole("button").className).toContain("touch-none");
  });

  it("draws the dragged digit as the landing preview on a valid target", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="valid"
        dropMode="value"
        dropDigit={6}
      />,
    );
    expect(screen.getByTestId("drop-preview")).toHaveTextContent("6");
  });

  it("fills the cell in value mode", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="valid"
        dropMode="value"
        dropDigit={6}
      />,
    );
    const preview = screen.getByTestId("drop-preview");
    expect(preview.dataset.mode).toBe("value");
    expect(preview.style.width).toBe("100%");
    expect(preview.style.height).toBe("100%");
  });

  it("highlights the top half as the active zone in value mode", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="valid"
        dropMode="value"
        dropDigit={6}
      />,
    );
    const zone = screen.getByTestId("drop-zone");
    expect(zone.style.top).toBe("0%");
  });

  it("highlights the bottom half as the active zone in note mode", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="valid"
        dropMode="note"
        dropDigit={6}
      />,
    );
    const zone = screen.getByTestId("drop-zone");
    expect(zone.style.top).toBe("50%");
  });

  it("morphs to the dragged digit's sub-cell in note mode", () => {
    // Digit 8 → note row 2, col 1 → left 33.33%, top 66.66%.
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="valid"
        dropMode="note"
        dropDigit={8}
      />,
    );
    const preview = screen.getByTestId("drop-preview");
    expect(preview.dataset.mode).toBe("note");
    expect(preview.style.left).toContain("33.3");
    expect(preview.style.top).toContain("66.6");
    expect(preview.style.width).toContain("33.3");
  });

  it("omits the drop preview on an invalid target", () => {
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="invalid"
        dropMode="note"
        dropDigit={6}
      />,
    );
    expect(screen.queryByTestId("drop-preview")).toBeNull();
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

describe("Cell digit palette hooks", () => {
  it("names the digit on its glyph so the palette can color it", () => {
    // The palette is CSS keyed on this attribute, which is how one
    // settings change repaints the board without re-rendering cells.
    render(<Cell {...defaultProps()} cell={makeCell({ value: 5 })} />);

    const digit = screen.getByText("5");
    expect(digit).toHaveAttribute("data-digit", "5");
    expect(digit.className).toContain("digit-ink");
  });

  it("names each pencil note, so a noted cell can show several colors", () => {
    // The point of coloring notes: one glance at a cell says which
    // candidates live there, without reading three small glyphs.
    const { container } = render(
      <Cell {...defaultProps()} cell={makeCell({ notes: new Set([2, 7]) })} />,
    );

    const noted = [...container.querySelectorAll("[data-digit]")].map((el) =>
      el.getAttribute("data-digit"),
    );
    expect(noted).toEqual(["2", "7"]);
  });

  it("marks givens on the glyph, so colors-only keeps them apart by shape", () => {
    // With the glyph gone, given-vs-entered can no longer ride on ink
    // color — every digit is already spending its hue on identity. The
    // palette gives givens a different shape instead.
    render(
      <Cell {...defaultProps()} cell={makeCell({ value: 4, isGiven: true })} />,
    );

    expect(screen.getByText("4")).toHaveAttribute("data-given", "true");
  });

  it("says so when a digit is the player's own, not just when it is given", () => {
    // Emoji mode marks entered symbols rather than givens — a symbol
    // has no weight to thicken — so "not given" has to be stated, not
    // inferred from a missing attribute that notes and numpad keys
    // also lack.
    render(<Cell {...defaultProps()} cell={makeCell({ value: 4 })} />);

    expect(screen.getByText("4")).toHaveAttribute("data-given", "false");
  });

  it("marks conflicts on the glyph, since a swatch cannot be underlined", () => {
    // The wavy underline is the colorblind-safe conflict marker in the
    // normal board, but colors-only replaces the glyph with a swatch
    // and there is nothing left to underline. The palette rings it.
    render(
      <Cell {...defaultProps()} cell={makeCell({ value: 5 })} isConflict />,
    );

    expect(screen.getByText("5")).toHaveAttribute("data-conflict", "true");
  });

  it("routes the landing preview through the palette", () => {
    // The preview promises the exact outcome of releasing here. Left
    // untagged it promises a numeral on a board that draws swatches.
    render(
      <Cell
        {...defaultProps()}
        cell={makeCell()}
        dropTargetState="valid"
        dropMode="value"
        dropDigit={8}
      />,
    );

    expect(
      screen.getByTestId("drop-preview").querySelector("[data-digit]"),
    ).toHaveTextContent("8");
  });

  it("routes the charging note through the palette", () => {
    render(<Cell {...defaultProps()} cell={makeCell()} chargingDigit={3} />);

    expect(
      screen.getByTestId("note-charge").querySelector("[data-digit]"),
    ).toHaveTextContent("3");
  });
});
