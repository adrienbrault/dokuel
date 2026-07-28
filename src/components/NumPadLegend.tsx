/**
 * The numpad's gesture cheat-sheet: a one-liner above the horizontal
 * pad, stacked words beside a vertical rail.
 */
export function NumPadLegend({ isVertical }: { isVertical: boolean }) {
  return (
    <p
      className={`text-[0.625rem] lg:text-xs text-text-muted leading-tight select-none ${isVertical ? "text-center whitespace-pre-line short:hidden" : ""}`}
      aria-hidden="true"
    >
      {isVertical
        ? "tap\nenter\n· · ·\nhold\nnote\n· · ·\ndrag\nplace"
        : "tap = enter · hold = note · drag = place"}
    </p>
  );
}
