import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { DigitDragIndicator } from "./DigitDragIndicator.tsx";

function makeState(overrides: Partial<DigitDragState> = {}): DigitDragState {
  return {
    digit: 5,
    source: { kind: "numpad" },
    x: 100,
    y: 200,
    target: null,
    invalidTarget: false,
    mode: "value",
    ...overrides,
  };
}

function mountCell(
  row: number,
  col: number,
  rect: { left: number; top: number; width: number; height: number },
): HTMLElement {
  const el = document.createElement("div");
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe("DigitDragIndicator", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns null when state is null", () => {
    const { container } = render(<DigitDragIndicator state={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the dragged digit", () => {
    const { getByTestId } = render(<DigitDragIndicator state={makeState()} />);
    expect(getByTestId("digit-drag-indicator").textContent).toBe("5");
  });

  it("starts in the 'intro' pose anchored at the source cell for cell drags", () => {
    // The intro pose anchors the indicator at the source cell so the
    // digit visually "lifts" from there on the next frame.
    mountCell(3, 4, { left: 100, top: 100, width: 50, height: 50 });
    const { getByTestId } = render(
      <DigitDragIndicator
        state={makeState({
          source: { kind: "cell", row: 3, col: 4 },
          target: null,
        })}
      />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("intro");
    // Centered on the source cell — left:100+25=125, top:100+25=125.
    expect(el.style.left).toBe("125px");
    expect(el.style.top).toBe("125px");
    expect(el.style.width).toBe("50px");
  });

  it("falls through to 'free' pose for numpad drags with no target", () => {
    // Numpad drags have no source cell, so the intro branch is
    // skipped and the indicator goes straight to following the pointer.
    const { getByTestId } = render(
      <DigitDragIndicator
        state={makeState({ x: 200, y: 300, target: null })}
      />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("free");
    // Lifted 40px above the pointer so the chip sits above the finger.
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("260px");
  });

  it("snaps to the cell center when hovering with value mode", () => {
    mountCell(1, 2, { left: 50, top: 50, width: 60, height: 60 });
    const { getByTestId } = render(
      <DigitDragIndicator
        state={makeState({
          target: { row: 1, col: 2 },
          mode: "value",
          x: 999, // pointer position should be ignored once anchored to cell
          y: 999,
        })}
      />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("value");
    expect(el.style.left).toBe("80px");
    expect(el.style.top).toBe("80px");
    expect(el.style.width).toBe("60px");
  });

  it("snaps to the digit's own sub-cell when hovering with note mode", () => {
    // Cell at (0,0)→(90,90), digit 7 lives in note row 2 / col 0
    // (bottom-left sub-cell). Sub-cell is 30×30, centered at
    // (0 + 0.5)*30 = 15 horizontally, (2 + 0.5)*30 = 75 vertically.
    mountCell(0, 0, { left: 0, top: 0, width: 90, height: 90 });
    const { getByTestId } = render(
      <DigitDragIndicator
        state={makeState({
          digit: 7,
          target: { row: 0, col: 0 },
          mode: "note",
        })}
      />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("note");
    expect(el.style.left).toBe("15px");
    expect(el.style.top).toBe("75px");
    expect(el.style.width).toBe("30px");
  });

  it("falls back to 'free' pose over an invalid target", () => {
    mountCell(1, 2, { left: 50, top: 50, width: 60, height: 60 });
    const { getByTestId } = render(
      <DigitDragIndicator
        state={makeState({
          target: { row: 1, col: 2 },
          invalidTarget: true,
          x: 200,
          y: 300,
        })}
      />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("free");
  });
});
