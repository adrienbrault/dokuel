import { useRef, useState } from "react";
import {
  type BackupPreview,
  exportBackupJson,
  importBackup,
  previewBackup,
} from "../lib/backup.ts";

type PendingBackup = {
  raw: string;
  preview: BackupPreview;
};

type BackupControlsProps = {
  onRestored?: () => void;
};

export function BackupControls({ onRestored }: BackupControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [message, setMessage] = useState("");

  function downloadBackup() {
    try {
      const blob = new Blob([exportBackupJson()], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dokuel-progress.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Progress backup downloaded.");
    } catch {
      setMessage("Your progress could not be exported.");
    }
  }

  async function inspectFile(file: File) {
    try {
      const raw = await file.text();
      const preview = previewBackup(raw);
      if (!preview) {
        setPending(null);
        setMessage("That backup file is invalid or unsupported.");
        return;
      }
      setPending({ raw, preview });
      setMessage("");
    } catch {
      setPending(null);
      setMessage("That backup file could not be read.");
    }
  }

  function replaceProgress() {
    if (!pending) return;
    if (importBackup(pending.raw)) {
      setPending(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onRestored?.();
      setMessage("Progress restored from the backup.");
    } else {
      setMessage(
        "Restore failed. Keep your backup and free storage before retrying.",
      );
    }
  }

  function cancelImport() {
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("");
  }

  return (
    <section aria-label="Progress backup" className="card p-4 w-full">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Progress backup
          </h3>
          <p className="caption mt-1">
            Save games, results, streaks, and learning progress in a file.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary w-full min-h-11"
          onClick={downloadBackup}
        >
          Export progress
        </button>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Import progress
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="block min-h-11 w-full text-sm text-text-secondary file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-surface-elevated file:px-3 file:py-2 file:text-text-primary"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void inspectFile(file);
            }}
          />
        </label>
        {pending && (
          <div className="flex flex-col gap-2 rounded border border-border-default p-3">
            <p className="text-sm text-text-primary">
              {formatCount(pending.preview.savedGames, "saved game")} ·{" "}
              {formatCount(pending.preview.resultCount, "result")} ·{" "}
              {formatCount(pending.preview.lifetimeGamesPlayed, "lifetime win")}
            </p>
            <p className="caption">
              This replaces your portable local progress. Multiplayer room data
              stays on this device.
            </p>
            <button
              type="button"
              className="btn btn-primary w-full min-h-11"
              onClick={replaceProgress}
            >
              Replace local progress
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full min-h-11"
              onClick={cancelImport}
            >
              Cancel import
            </button>
          </div>
        )}
        {message && (
          <p role="status" aria-live="polite" className="caption">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function formatCount(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
