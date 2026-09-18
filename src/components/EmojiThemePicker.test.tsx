import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmojiThemePicker } from "./EmojiThemePicker.tsx";

describe("EmojiThemePicker", () => {
  it("offers every theme by name, not by symbol alone", () => {
    // The symbols are the preview; the name is what a screen reader
    // and a colorblind player have to go on.
    render(<EmojiThemePicker theme="shapes" onChange={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(10);
    expect(screen.getByRole("radio", { name: "Fruit" })).toBeInTheDocument();
  });

  it("reports the theme the player picks", async () => {
    const onChange = vi.fn();
    render(<EmojiThemePicker theme="shapes" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Animals" }));

    expect(onChange).toHaveBeenCalledWith("animals");
  });

  it("marks the current theme as chosen", () => {
    render(<EmojiThemePicker theme="space" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { checked: true })).toHaveAccessibleName(
      "Space",
    );
  });
});
