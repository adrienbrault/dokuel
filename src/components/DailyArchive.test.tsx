import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordDailyResult } from "../lib/daily-results.ts";
import { todayLocalISO } from "../lib/date.ts";
import { formatShortDate } from "../lib/format.ts";
import { DailyArchive } from "./DailyArchive.tsx";

describe("DailyArchive", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("shows the time a past daily was solved in", () => {
    const today = todayLocalISO();
    recordDailyResult(today, 300);

    render(<DailyArchive onBack={vi.fn()} onPlay={vi.fn()} />);

    expect(
      screen.getByRole("button", {
        name: new RegExp(`${formatShortDate(today)}.*05:00`),
      }),
    ).toBeInTheDocument();
  });

  it("opens the daily for the date that was tapped", async () => {
    const onPlay = vi.fn();
    render(<DailyArchive onBack={vi.fn()} onPlay={onPlay} />);

    const today = todayLocalISO();
    await userEvent.click(
      screen.getByRole("button", {
        name: new RegExp(formatShortDate(today)),
      }),
    );

    expect(onPlay).toHaveBeenCalledWith(today);
  });

  it("keeps older months behind a Show more button", async () => {
    // The archive grows by one row a day forever; a first screen that
    // renders every date since launch is a scroll nobody asked for.
    render(<DailyArchive onBack={vi.fn()} onPlay={vi.fn()} />);
    const before = screen.getAllByRole("button").length;

    await userEvent.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getAllByRole("button").length).toBeGreaterThan(before);
  });
});
