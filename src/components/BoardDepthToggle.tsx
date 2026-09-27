import { useBoard3D } from "../hooks/useBoard3D.ts";
import { supportsWebGL } from "../lib/board-3d.ts";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

/** Settings row for the WebGL board; hidden where it cannot render. */
export function BoardDepthToggle() {
  const { enabled, setEnabled } = useBoard3D();
  if (!supportsWebGL()) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border-default">
      <ToggleSwitch
        checked={enabled}
        onChange={() => setEnabled(!enabled)}
        label="3D board"
      />
    </div>
  );
}
