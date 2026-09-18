import { EMOJI_THEMES } from "../lib/emoji-themes.ts";

/**
 * Picks which set of symbols stands in for the digits.
 *
 * Ten themes is too many for a sliding group, so they sit in a grid
 * previewing their own first three symbols. The theme's name is the
 * accessible name: a grid of pictures alone would leave a screen
 * reader with nothing to read out.
 */
export function EmojiThemePicker({
  theme,
  onChange,
}: {
  theme: string;
  onChange: (theme: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Emoji theme"
      className="grid grid-cols-5 gap-1.5"
    >
      {EMOJI_THEMES.map((option) => {
        const isActive = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.id)}
            className={`flex items-center justify-center rounded-lg py-1.5 text-sm leading-none transition-colors select-none touch-manipulation focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              isActive
                ? "bg-accent-light ring-2 ring-accent ring-inset"
                : "bg-bg-inset hover:bg-bg-raised"
            }`}
          >
            <span aria-hidden="true">{option.symbols[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
