import type { CellOverlay } from "../../lib/guides/types.ts";

type DemoOverlaysProps = {
  overlays: Map<number, CellOverlay[]>;
};

export function DemoOverlays({ overlays }: DemoOverlaysProps) {
  return (
    <div
      className="absolute inset-0 grid grid-cols-9 pointer-events-none"
      aria-hidden="true"
    >
      {Array.from({ length: 81 }, (_, i) => {
        const cellOverlays = overlays.get(i) ?? [];
        return <OverlayCell key={i} overlays={cellOverlays} />;
      })}
    </div>
  );
}

function OverlayCell({ overlays }: { overlays: CellOverlay[] }) {
  const hasUnit = overlays.some((o) => o.kind === "unit");
  const hasSolution = overlays.some((o) => o.kind === "solution");
  const eliminate = overlays.find((o) => o.kind === "eliminate");
  return (
    <div className="relative aspect-square">
      {hasUnit && (
        <div className="absolute inset-0 bg-blue-400/15 dark:bg-blue-500/12 animate-demo-fade-in" />
      )}
      {eliminate && eliminate.digits && eliminate.digits.length > 0 && (
        <div className="absolute inset-0 bg-red-400/15 dark:bg-red-500/15 animate-demo-fade-in">
          <span className="absolute top-0.5 right-0.5 text-[8px] sm:text-[9px] font-bold text-red-600 dark:text-red-400">
            −{eliminate.digits.join(",")}
          </span>
        </div>
      )}
      {hasSolution && (
        <div className="absolute inset-0 ring-2 ring-emerald-500 dark:ring-emerald-400 rounded-sm animate-demo-pulse" />
      )}
    </div>
  );
}
