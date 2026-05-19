import { Volume2, VolumeX } from "lucide-react";

type SoundToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      className="btn-icon"
      onClick={onToggle}
      aria-label={enabled ? "Mute sounds" : "Enable sounds"}
    >
      {enabled ? (
        <Volume2 size={20} aria-hidden="true" />
      ) : (
        <VolumeX size={20} aria-hidden="true" />
      )}
    </button>
  );
}
