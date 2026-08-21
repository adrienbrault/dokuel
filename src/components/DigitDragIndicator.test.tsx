import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DigitDragState } from "../hooks/useDigitGesture.ts";
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
    lift: 0,
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

  it("sits right at the cursor for a mouse drag", () => {
    const { getByTestId } = render(
      <DigitDragIndicator state={makeState({ x: 200, y: 300, lift: 0 })} />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("free");
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("300px");
  });

  it("rides well above the finger for a touch drag", () => {
    const { getByTestId } = render(
      <DigitDragIndicator state={makeState({ x: 200, y: 300, lift: 46 })} />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("254px");
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
    expect(el.style.top).toBe("300px");
  });

  it("dims to a quiet marker over a valid target and sheds its digit", () => {
    // Over a valid cell the cell draws its own landing preview that
    // animates the digit toward the note or value slot. The transit
    // chip stays visible but dims to a quiet position marker, and the
    // digit decouples from the chip so it is never shown in two places.
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
    expect(el.dataset.pose).toBe("dimmed");
    expect(el.style.opacity).toBe("0.15");
    const digit = el.querySelector("span");
    expect(digit?.style.opacity).toBe("0");
    // Still positioned at the pointer so it tracks while it dims.
    expect(el.style.left).toBe("150px");
    expect(el.style.top).toBe("250px");
  });
});
