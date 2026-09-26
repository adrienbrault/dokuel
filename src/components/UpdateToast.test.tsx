import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SwUpdates } from "../lib/sw-updates.ts";
import { UpdateToast } from "./UpdateToast.tsx";

function fakeUpdates(ready: boolean) {
  const listeners = new Set<() => void>();
  const updates = {
    ready,
    track: vi.fn(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isUpdateReady: () => updates.ready,
    applyUpdate: vi.fn(),
    announce() {
      updates.ready = true;
      for (const l of listeners) l();
    },
  };
  return updates;
}

describe("UpdateToast", () => {
  it("appears once a new version is ready and reloads on request", async () => {
    const updates = fakeUpdates(false);
    render(<UpdateToast updates={updates satisfies SwUpdates} />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => updates.announce());

    expect(screen.getByRole("status")).toHaveTextContent("Update available");
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(updates.applyUpdate).toHaveBeenCalledTimes(1);
  });
});
