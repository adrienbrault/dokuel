import type { DigitColorMode } from "../lib/types.ts";
import { SlidingRadioGroup } from "./SlidingRadioGroup.tsx";

const OPTIONS: { value: DigitColorMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "digits", label: "Tinted" },
  { value: "colors", label: "Colors" },
];

/**
 * Picks how the board paints digits: plain, one hue per digit, or hue
 * alone with the glyph dropped. Three states rather than a toggle,
 * because colors-only is a different board to read, not a louder
 * version of the tinted one.
 */
export function DigitColorPicker({
  mode,
  onChange,
}: {
  mode: DigitColorMode;
  onChange: (mode: DigitColorMode) => void;
}) {
  return (
    <SlidingRadioGroup
      options={OPTIONS}
      value={mode}
      onChange={onChange}
      name="digit-color-mode"
      ariaLabel="Digit colors"
    />
  );
}
