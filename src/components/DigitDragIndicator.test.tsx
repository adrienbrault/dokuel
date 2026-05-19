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

  it("offsets the chip above the cursor for a mouse drag", () => {
    const { getByTestId } = render(
      <DigitDragIndicator state={makeState({ x: 200, y: 300, lift: 20 })} />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.dataset.pose).toBe("free");
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("280px");
  });

  it("rides further above the finger for a touch drag", () => {
    const { getByTestId } = render(
      <DigitDragIndicator state={makeState({ x: 200, y: 300, lift: 56 })} />,
    );
    const el = getByTestId("digit-drag-indicator");
    expect(el.style.left).toBe("200px");
    expect(el.style.top).toBe("244px");
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

  it("hides itself over a valid target so the cell's previews lead", () => {
    // Over a valid cell the cell draws its own two landing previews;
    // the transit chip fades out to keep attention on one surface.
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
    expect(el.dataset.pose).toBe("hidden");
    expect(el.style.opacity).toBe("0");
    // Still positioned at the pointer so it fades in place when the
    // pointer leaves the cell.
    expect(el.style.left).toBe("150px");
    expect(el.style.top).toBe("250px");
  });
});
