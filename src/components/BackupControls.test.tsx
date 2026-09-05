import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportBackupJson } from "../lib/backup.ts";
import { loadGame, type SavedGame, saveGame } from "../lib/game-storage.ts";
import { BackupControls } from "./BackupControls.tsx";

const VALID_GAME: SavedGame = {
  puzzle: ".".repeat(81),
  values: ".".repeat(81),
  notes: Array.from({ length: 81 }, () => []),
  timer: 42,
  difficulty: "medium",
  assistLevel: "standard",
  hintsUsed: 0,
};

describe("BackupControls", () => {
  beforeEach(() => localStorage.clear());

  it("downloads a JSON backup", () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:backup");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<BackupControls />);

    fireEvent.click(screen.getByRole("button", { name: /export progress/i }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:backup");
  });

  it("previews a valid file and replaces progress only after its button is pressed", async () => {
    saveGame("incoming", VALID_GAME);
    const raw = exportBackupJson();
    localStorage.clear();
    saveGame("existing", VALID_GAME);
    const onRestored = vi.fn();
    render(<BackupControls onRestored={onRestored} />);

    const file = new File([raw], "dokuel-progress.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText(/import progress/i), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByText(/1 saved game/i)).toBeInTheDocument(),
    );
    expect(loadGame("existing")).toEqual(VALID_GAME);
    expect(loadGame("incoming")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /replace local progress/i }),
    );
    expect(loadGame("existing")).toBeNull();
    expect(loadGame("incoming")).toEqual(VALID_GAME);
    expect(screen.getByRole("status")).toHaveTextContent(/restored/i);
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("lets players cancel a preview without replacing progress", async () => {
    saveGame("incoming", VALID_GAME);
    const raw = exportBackupJson();
    localStorage.clear();
    saveGame("existing", VALID_GAME);
    render(<BackupControls />);

    fireEvent.change(screen.getByLabelText(/import progress/i), {
      target: {
        files: [
          new File([raw], "dokuel-progress.json", {
            type: "application/json",
          }),
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByText(/1 saved game/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel import/i }));
    expect(screen.queryByText(/1 saved game/i)).toBeNull();
    expect(loadGame("existing")).toEqual(VALID_GAME);
    expect(loadGame("incoming")).toBeNull();
  });

  it("reports restore failure without promising a rollback", async () => {
    saveGame("incoming", VALID_GAME);
    const raw = exportBackupJson();
    localStorage.clear();
    saveGame("existing", VALID_GAME);
    render(<BackupControls />);
    fireEvent.change(screen.getByLabelText(/import progress/i), {
      target: {
        files: [
          new File([raw], "dokuel-progress.json", {
            type: "application/json",
          }),
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByText(/1 saved game/i)).toBeInTheDocument(),
    );

    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    try {
      fireEvent.click(
        screen.getByRole("button", { name: /replace local progress/i }),
      );
    } finally {
      spy.mockRestore();
    }

    expect(screen.getByRole("status")).toHaveTextContent(
      /free storage before retrying/i,
    );
    expect(screen.queryByText(/current data is unchanged/i)).toBeNull();
  });

  it("reports an invalid file without changing progress", async () => {
    saveGame("existing", VALID_GAME);
    render(<BackupControls />);
    const file = new File(["not a backup"], "broken.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText(/import progress/i), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/invalid/i),
    );
    expect(loadGame("existing")).toEqual(VALID_GAME);
  });
});
