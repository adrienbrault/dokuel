import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { recordResult } from "../lib/result-store.ts";
import { SoloStats } from "./SoloStats.tsx";

it("shows comparable recent solves with their assistance and hint context", () => {
  localStorage.clear();
  recordResult({
    difficulty: "hard",
    assistLevel: "paper",
    time: 91,
    won: true,
    hintsUsed: 1,
    metadata: { origin: "friend", attemptId: "receipt", date: "2026-09-01" },
  });
  render(<SoloStats />);
  fireEvent.change(screen.getByRole("combobox", { name: "Puzzle source" }), {
    target: { value: "friend" },
  });
  const history = within(
    screen.getByRole("region", { name: "Recent solo results" }),
  );
  expect(history.getByText("01:31")).toBeInTheDocument();
  expect(history.getByText(/Paper.*1 hint/)).toBeInTheDocument();
});
