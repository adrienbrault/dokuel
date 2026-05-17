import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { DigitDragGhost } from "./DigitDragGhost.tsx";

function makeState(overrides: Partial<DigitDragState> = {}): DigitDragState {
  return {
    digit: 5,
    source: { kind: "numpad" },
    x: 100,
    y: 200,
    target: null,
    invalidTarget: false,
    ...overrides,
  };
}

describe("DigitDragGhost", () => {
  it("renders the dragged digit", () => {
    const { getByTestId } = render(<DigitDragGhost state={makeState()} />);
    expect(getByTestId("digit-drag-ghost").textContent).toBe("5");
  });

  it("positions itself at the pointer", () => {
    const { getByTestId } = render(
      <DigitDragGhost state={makeState({ x: 123, y: 456 })} />,
    );
    const ghost = getByTestId("digit-drag-ghost");
    expect(ghost.style.left).toBe("123px");
    expect(ghost.style.top).toBe("456px");
  });

  it("signals a valid drop target with a data attribute", () => {
    const { getByTestId } = render(
      <DigitDragGhost
        state={makeState({
          target: { row: 1, col: 2 },
          invalidTarget: false,
        })}
      />,
    );
    expect(getByTestId("digit-drag-ghost").dataset.dropState).toBe("valid");
  });

  it("signals an invalid drop target with a data attribute", () => {
    const { getByTestId } = render(
      <DigitDragGhost
        state={makeState({
          target: { row: 1, col: 2 },
          invalidTarget: true,
        })}
      />,
    );
    expect(getByTestId("digit-drag-ghost").dataset.dropState).toBe("invalid");
  });

  it("signals no target when hovering nothing", () => {
    const { getByTestId } = render(
      <DigitDragGhost state={makeState({ target: null })} />,
    );
    expect(getByTestId("digit-drag-ghost").dataset.dropState).toBe("none");
  });

  it("returns null when state is null", () => {
    const { container } = render(<DigitDragGhost state={null} />);
    expect(container.firstChild).toBeNull();
  });
});
