import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "./Landing.tsx";

function renderLanding(overrides: Partial<Parameters<typeof Landing>[0]> = {}) {
  const props = {
    onSolo: vi.fn(),
    onDaily: vi.fn(),
    onCreate: vi.fn(),
    onJoin: vi.fn(),
    onContinue: vi.fn(),
    onStats: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  };
  render(<Landing {...props} />);
  return props;
}

describe("Landing", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("opens the past dailies archive from a secondary link", async () => {
    // Secondary, next to View Stats: the four primary rows are the
    // pitch, and a fifth row would dilute them.
    const props = renderLanding();

    await userEvent.click(
      screen.getByRole("button", { name: /past dailies/i }),
    );

    expect(props.onArchive).toHaveBeenCalledOnce();
    expect(props.onDaily).not.toHaveBeenCalled();
  });
});
