import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactionPicker } from "./ReactionPicker.tsx";

describe("ReactionPicker", () => {
  it("keeps the emoji behind one button until asked", () => {
    // Four inline emoji do not fit next to Undo and Erase on the
    // smallest phone, so the row lives in a popover.
    render(<ReactionPicker onSend={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Send 🔥" })).toBeNull();
  });

  it("sends the emoji the player picked and closes", () => {
    const onSend = vi.fn();
    render(<ReactionPicker onSend={onSend} />);

    fireEvent.click(screen.getByRole("button", { name: "Send a reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Send 🔥" }));

    expect(onSend).toHaveBeenCalledWith("🔥");
    expect(screen.queryByRole("button", { name: "Send 🔥" })).toBeNull();
  });

  it("closes on Escape without sending anything", () => {
    const onSend = vi.fn();
    render(<ReactionPicker onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Send a reaction" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Send 🔥" })).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });
});
