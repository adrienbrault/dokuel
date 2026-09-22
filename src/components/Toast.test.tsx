import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast.tsx";

describe("Toast", () => {
  it("announces its message as an alert", () => {
    // Toasts carry transient errors ("Need 2 players to start"); with
    // no live-region role a screen reader never hears them.
    render(<Toast message="Need 2 players to start" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Need 2 players to start",
    );
  });

  it("offers an action button for notices the player can act on", async () => {
    const onClick = vi.fn();
    render(
      <Toast
        tone="info"
        message="Update available"
        action={{ label: "Reload", onClick }}
      />,
    );

    // Informational, not an error: a polite status, not an alert.
    expect(screen.getByRole("status")).toHaveTextContent("Update available");
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("offsets below the notch safe area", () => {
    render(<Toast message="hi" />);
    const el = screen.getByRole("alert");
    expect(el.style.top).toContain("env(safe-area-inset-top)");
  });
});
