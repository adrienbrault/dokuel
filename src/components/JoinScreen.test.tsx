import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JoinScreen } from "./JoinScreen.tsx";

describe("JoinScreen", () => {
  it("normalizes pasted/typed codes to the lowercase room id", () => {
    // Mobile keyboards autocapitalize and messaging apps title-case
    // links. Yjs room names are case-sensitive: "Loud-Duck-7KMQ" is a
    // DIFFERENT, empty room the joiner would wait in forever.
    const onJoin = vi.fn();
    render(<JoinScreen onJoin={onJoin} onBack={vi.fn()} />);

    const input = screen.getByLabelText(/room code/i);
    fireEvent.change(input, { target: { value: "  Loud-Duck-7KMQ  " } });
    fireEvent.submit(input.closest("form")!);

    expect(onJoin).toHaveBeenCalledWith("loud-duck-7kmq");
  });

  it("disables mobile keyboard mangling on the code input", () => {
    render(<JoinScreen onJoin={vi.fn()} onBack={vi.fn()} />);

    const input = screen.getByLabelText(/room code/i);
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
  });
});
