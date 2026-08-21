import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { NumPadGesture } from "../hooks/useDigitGesture.ts";
import { NumPad } from "./NumPad.tsx";

/**
 * The pad is a view: it paints digits, says what a tap will do, and
 * hands the gesture recognizer the two things its hit-tests need — a
 * `data-numpad-digit` on every key and the digit row itself. What a
 * press MEANS is useDigitGesture's answer (see useDigitGesture.test.tsx).
 */

const ZERO_REMAINING = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };

const NO_HANDLERS = {
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onPointerLeave: () => {},
  onPointerCancel: () => {},
  onClick: () => {},
};

function stubGesture(overrides: Partial<NumPadGesture> = {}): NumPadGesture {
  return {
    keyProps: () => NO_HANDLERS,
    groupRef: createRef<HTMLDivElement>(),
    pressedDigit: null,
    ...overrides,
  };
}

function hasAccent(el: HTMLElement) {
  return el.classList.contains("bg-accent");
}

describe("NumPad", () => {
  it("spreads the recognizer's handlers onto the matching digit key", () => {
    const pressed = vi.fn();
    const keyProps = (n: number) => ({
      ...NO_HANDLERS,
      onPointerDown: () => pressed(n),
    });
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        gesture={stubGesture({ keyProps })}
      />,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: /^7, / }));
    expect(pressed).toHaveBeenCalledWith(7);
  });

  it("hands the digit row to the recognizer through groupRef", () => {
    // The row's board-facing edge is the promotion boundary: without
    // this ref a skim never becomes a drag.
    const groupRef = createRef<HTMLDivElement>();
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        gesture={stubGesture({ groupRef })}
      />,
    );
    expect(groupRef.current).toBe(
      screen.getByRole("group", { name: "Number pad" }),
    );
  });

  it("marks every key with its digit for the gesture hit-tests", () => {
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        gesture={stubGesture()}
      />,
    );
    const marked = document.querySelectorAll("[data-numpad-digit]");
    expect(marked).toHaveLength(9);
  });

  it("disables a completed digit's key", () => {
    // A disabled key is invisible, and the skim deliberately refuses to
    // land on one — the pad states the completeness, the recognizer
    // reads it off the DOM.
    render(
      <NumPad
        position="bottom"
        remainingCounts={{ ...ZERO_REMAINING, 5: 0 }}
        gesture={stubGesture()}
      />,
    );
    const five = document.querySelector(
      '[data-numpad-digit="5"]',
    ) as HTMLButtonElement;
    expect(five.disabled).toBe(true);
  });

  it("accents the pressed digit over the selected value", () => {
    // The press visual follows the finger across skim transitions, so
    // whatever the recognizer reports as pressed wins over the
    // selection's value.
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        selectedValue={3}
        gesture={stubGesture({ pressedDigit: 5 })}
      />,
    );
    expect(hasAccent(screen.getByRole("button", { name: /^5, / }))).toBe(true);
    expect(hasAccent(screen.getByRole("button", { name: /^3, / }))).toBe(false);
  });

  it("accents the selected value while no digit is pressed", () => {
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        selectedValue={3}
        gesture={stubGesture()}
      />,
    );
    expect(hasAccent(screen.getByRole("button", { name: /^3, / }))).toBe(true);
  });

  it("renders the discoverability caption above the digits", () => {
    render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        gesture={stubGesture()}
      />,
    );
    expect(screen.getByText(/tap = enter · hold = note/i)).toBeInTheDocument();
  });

  it("legend switches to note-mode wording when a tap pencils notes", () => {
    // With a multi-cell selection active, a tap pencils notes (same as
    // hold) — "tap = enter" would promise the wrong thing at exactly
    // the moment the player is looking for confirmation of their
    // range. The legend follows the live tap action.
    const { rerender } = render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        tapAction="note"
        gesture={stubGesture()}
      />,
    );
    expect(
      screen.getByText("tap = note · hold = note · drag = place"),
    ).toBeInTheDocument();

    // Selection cleared → back to the default wording.
    rerender(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        tapAction="enter"
        gesture={stubGesture()}
      />,
    );
    expect(
      screen.getByText("tap = enter · hold = note · drag = place"),
    ).toBeInTheDocument();
  });

  it("renders digits as pencil-note previews while a tap will note", () => {
    // Pre-press affordance: with a range selected, each key shows its
    // digit as a small pencil mark in its 3×3 note-grid slot — the
    // numpad previews the exact artifact a press will create, instead
    // of a caption describing it. The accessible name says so too.
    const { rerender } = render(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        tapAction="note"
        gesture={stubGesture()}
      />,
    );
    const noteKey = screen.getByRole("button", { name: "5, pencil note" });
    expect(noteKey.querySelector("[data-note-preview]")).not.toBeNull();

    // Back to enter-mode: full-size digit, remaining count, no preview.
    rerender(
      <NumPad
        position="bottom"
        remainingCounts={ZERO_REMAINING}
        tapAction="enter"
        gesture={stubGesture()}
      />,
    );
    const valueKey = screen.getByRole("button", { name: "5, 9 remaining" });
    expect(valueKey.querySelector("[data-note-preview]")).toBeNull();
  });
});
