import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CursorDebugHud } from "./CursorDebugHud.tsx";

/**
 * The HUD exists because three cursor fixes in a row were green in
 * headless Chromium and dead on the reporter's machine. Everything it
 * shows is what we cannot see from here: the real hit-test stack under
 * the real pointer, on the real browser profile — extensions included.
 */
function stackUnderPointer(stack: Element[]) {
  document.elementsFromPoint = (() =>
    stack) as typeof document.elementsFromPoint;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
}

function movePointer() {
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      clientX: 10,
      clientY: 10,
      pointerType: "mouse",
    }),
  );
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("CursorDebugHud", () => {
  it("stays out of the page without the flag", () => {
    render(<CursorDebugHud />);
    expect(screen.queryByTestId("cursor-debug-hud")).toBeNull();
  });

  it("lists the hit-test stack under the pointer, topmost first", async () => {
    // The one question the HUD answers: WHAT does the browser resolve
    // the cursor from? If an injected iframe tops this list, the arrow
    // comes from inside it and no CSS of ours can ever reach it.
    window.history.replaceState(null, "", "/?cursor-debug");
    const overlay = document.createElement("iframe");
    const cell = document.createElement("button");
    cell.dataset.cellFilled = "true";
    cell.id = "r4c2";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    stackUnderPointer([overlay, icon, cell]);

    render(<CursorDebugHud />);
    await act(async () => {
      movePointer();
      await nextFrame();
    });

    const hud = screen.getByTestId("cursor-debug-hud");
    expect(hud.textContent).toContain("0 iframe");
    expect(hud.textContent).toContain("svg");
    expect(hud.textContent).toContain("button#r4c2[filled]");
    expect(hud.textContent).toContain("moves 1");
  });

  it("counts document leaves — a pointer-following overlay's footprint", async () => {
    // Moving onto an injected iframe fires pointerleave on OUR
    // document even though the pointer never left the window. A climbing
    // leaves counter while the mouse sits still is that overlay,
    // catching up.
    window.history.replaceState(null, "", "/?cursor-debug");
    stackUnderPointer([]);

    render(<CursorDebugHud />);
    await act(async () => {
      movePointer();
      document.dispatchEvent(new PointerEvent("pointerleave"));
      await nextFrame();
    });

    const hud = screen.getByTestId("cursor-debug-hud");
    expect(hud.textContent).toContain("leaves 1");
    // Empty stack: nothing under the pointer to read a cursor from.
    expect(hud.textContent).toContain("computed -");
  });

  it("keeps sampling while the pointer rests", () => {
    // The failure being chased happens AFTER the last pointermove — an
    // overlay that trails the pointer arrives once it stops. A HUD that
    // only samples on move would freeze one frame too early, showing
    // the healthy stack forever.
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/?cursor-debug");
    stackUnderPointer([document.createElement("iframe")]);

    render(<CursorDebugHud />);
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId("cursor-debug-hud").textContent).toContain(
      "iframe",
    );
  });
});
