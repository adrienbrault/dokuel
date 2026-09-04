import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { InputGuide } from "./InputGuide.tsx";

beforeEach(() => localStorage.clear());

it("lets a new player practice value and note entry, then dismiss the guide", () => {
  const { unmount } = render(<InputGuide />);
  fireEvent.click(screen.getByRole("button", { name: "Try the controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Practice cell" }));
  fireEvent.click(screen.getByRole("button", { name: "Practice digit 5" }));
  expect(screen.getByRole("status")).toHaveTextContent("Value placed");
  fireEvent.click(screen.getByRole("button", { name: "Try notes" }));
  fireEvent.click(screen.getByRole("button", { name: "Practice digit 5" }));
  expect(screen.getByRole("status")).toHaveTextContent("Note added");
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(screen.queryByRole("button", { name: "Practice cell" })).toBeNull();
  unmount();
  render(<InputGuide />);
  expect(screen.getByRole("button", { name: "How to play" })).toBeTruthy();
});
