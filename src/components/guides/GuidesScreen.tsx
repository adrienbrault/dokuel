import { useGuideProgress } from "../../hooks/useGuideProgress.ts";
import type { Guide, Level, TechniqueId } from "../../lib/guides/types.ts";

type GuidesScreenProps = {
  guides: Guide[];
  onSelect: (id: TechniqueId) => void;
  onBack: () => void;
};

const TIER_ORDER: Level[] = ["beginner", "intermediate", "advanced"];
const TIER_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function GuidesScreen({ guides, onSelect, onBack }: GuidesScreenProps) {
  const progress = useGuideProgress();
  return (
    <div className="screen-content gap-6">
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={onBack}
        >
          ← Back
        </button>
        <span className="label">Learn</span>
      </div>
      <h1 className="heading">Strategy Guides</h1>
      {TIER_ORDER.map((tier) => {
        const inTier = guides.filter((g) => g.level === tier);
        if (inTier.length === 0) return null;
        return (
          <section key={tier} className="flex flex-col gap-3 w-full">
            <span className="label">{TIER_LABEL[tier]}</span>
            {inTier.map((guide) => (
              <button
                key={guide.id}
                type="button"
                className="card flex flex-col items-start gap-1 p-4 text-left w-full hover:border-accent transition-colors"
                onClick={() => onSelect(guide.id)}
              >
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary">
                    {guide.title}
                  </span>
                  {progress.isNew(guide.id) && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      New
                    </span>
                  )}
                </span>
                <span className="text-sm text-text-muted">{guide.summary}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}
