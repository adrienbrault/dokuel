import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("DigitDragIndicator", () => {
  it("returns null when state is null", () => {
    const { container } = render(<DigitDragIndicator state={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the dragged digit", () => {
    const { getByTestId } = render(<DigitDragIndicator state={makeState()} />);
    expect(getByTestId("digit-drag-indicator").textContent).toBe("5");
  });

  it("tracks the pointer lifted 40px above the finger when in the 'free' pose", () => {
    const { getByTestId } = render(
      <DigitDragIndicator state={makeState({ x: 200, y: 300 })} />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("free");
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("260px");
  });

  it("stays free-following but switches to the 'invalid' pose over a non-droppable cell", () => {
    // The chip never snaps into a cell anymore — only its color
    // changes so the user sees that releasing here is a no-op.
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
    expect(el.dataset.pose).toBe("invalid");
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("260px");
  });

  it("stays in the 'free' pose over a valid target", () => {
    // Over a valid cell, the indicator still follows the pointer
    // instead of snapping into a slot — the cell's own halves
    // communicate which mode is active.
    const { getByTestId } = render(
      <DigitDragIndicator
        state={makeState({
          target: { row: 1, col: 2 },
          invalidTarget: false,
          mode: "value",
          x: 150,
          y: 250,
        })}
      />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("free");
    expect(el.style.left).toBe("150px");
    expect(el.style.top).toBe("210px");
  });
});
