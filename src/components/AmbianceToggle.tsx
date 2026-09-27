import { Sparkles } from "lucide-react";
import { useAmbianceEnabled } from "../hooks/useAmbianceEnabled.ts";
import { setAmbianceEnabled } from "../lib/ambiance-settings.ts";

/** Icon button that turns the 3D world behind the app on and off. */
export function AmbianceToggle() {
  const enabled = useAmbianceEnabled();
  return (
    <button
      type="button"
      className={`icon-btn w-9 h-9 touch-manipulation ${enabled ? "text-accent" : ""}`}
      onClick={() => setAmbianceEnabled(!enabled)}
      aria-label="3D world"
      aria-pressed={enabled}
    >
      <Sparkles size={17} aria-hidden="true" />
    </button>
  );
}
