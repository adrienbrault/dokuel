import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

  it("offsets below the notch safe area", () => {
    render(<Toast message="hi" />);
    const el = screen.getByRole("alert");
    expect(el.style.top).toContain("env(safe-area-inset-top)");
  });
});
