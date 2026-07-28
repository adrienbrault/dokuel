import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    localStorage.clear();
    // React logs caught render errors; keep test output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary reload={() => {}}>
        <div>all good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows the recovery screen when a child throws during render", () => {
    render(
      <ErrorBoundary reload={() => {}}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("reload button calls the reload handler", async () => {
    const reload = vi.fn();
    render(
      <ErrorBoundary reload={reload}>
        <Boom />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("clear-and-reload removes saved games but keeps stats and streaks", async () => {
    localStorage.setItem("sudoku_save_abc", "{corrupt");
    localStorage.setItem("sudoku_save_daily-2026-07-27-medium", "{corrupt");
    localStorage.setItem("sudoku_stats", '{"kept":true}');
    localStorage.setItem("sudoku_daily_streak", '{"kept":true}');
    const reload = vi.fn();
    render(
      <ErrorBoundary reload={reload}>
        <Boom />
      </ErrorBoundary>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Clear saved games & reload" }),
    );
    expect(localStorage.getItem("sudoku_save_abc")).toBeNull();
    expect(
      localStorage.getItem("sudoku_save_daily-2026-07-27-medium"),
    ).toBeNull();
    expect(localStorage.getItem("sudoku_stats")).toBe('{"kept":true}');
    expect(localStorage.getItem("sudoku_daily_streak")).toBe('{"kept":true}');
    expect(reload).toHaveBeenCalledOnce();
  });
});
