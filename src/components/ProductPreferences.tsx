import { useState } from "react";
import {
  getMeasurementConsent,
  setMeasurementConsent,
  trackProductEvent,
} from "../lib/product-events.ts";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

const IDEAS = [
  ["interest_quick", "Short duels"],
  ["interest_cosmetics", "Board themes"],
  ["interest_collections", "Puzzle collections"],
  ["interest_learning", "Guided lessons"],
] as const;

export function ProductPreferences() {
  const [enabled, setEnabled] = useState(getMeasurementConsent);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  return (
    <details className="card p-4 w-full text-sm">
      <summary className="cursor-pointer font-medium text-text-secondary">
        Privacy & help shape Dokuel
      </summary>
      <div className="flex flex-col gap-4 pt-4">
        <ToggleSwitch
          label="Share anonymous usage"
          checked={enabled}
          onChange={() => {
            const next = !enabled;
            if (setMeasurementConsent(next)) {
              setEnabled(next);
              setMessage(
                next
                  ? "Anonymous usage enabled."
                  : "No more usage events will be sent.",
              );
            } else
              setMessage(
                "Your choice could not be saved. Usage sharing is unchanged.",
              );
          }}
        />
        <p className="caption">
          Off by default. If enabled, Dokuel sends event names, game mode, and
          rounded minutes to Cloudflare. No player names, room codes, puzzles,
          or persistent identifiers are included. Network requests still expose
          your IP to Cloudflare; Dokuel does not store it in these events.
          Switch off at any time.
        </p>
        <p className="text-text-secondary">
          What would you use next? These are ideas under consideration.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {IDEAS.map(([event, label]) => (
            <button
              key={event}
              type="button"
              disabled={sent.includes(event)}
              className="btn btn-secondary px-3 py-2"
              onClick={() => {
                if (!enabled) {
                  setMessage(
                    "Enable anonymous usage above if you want to send a preference.",
                  );
                  return;
                }
                trackProductEvent(event);
                setSent([...sent, event]);
                setMessage(
                  "Thanks for sharing your preference. Delivery depends on your connection.",
                );
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {message && (
          <p role="status" className="caption">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
