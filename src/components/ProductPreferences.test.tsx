import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductPreferences } from "./ProductPreferences.tsx";

afterEach(() => vi.unstubAllGlobals());
it("offers a reversible privacy choice before sending a feature preference", () => {
  localStorage.clear();
  const send = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", send);
  render(<ProductPreferences />);
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  fireEvent.click(screen.getByRole("button", { name: "Short duels" }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.click(screen.getByRole("button", { name: "Short duels" }));
  expect(send).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
});
