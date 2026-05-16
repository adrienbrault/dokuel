import { useEffect } from "react";
import { useGuideProgress } from "../../hooks/useGuideProgress.ts";
import type { Guide } from "../../lib/guides/types.ts";
import { ChallengePanel } from "./ChallengePanel.tsx";
import { TechniqueDemo } from "./TechniqueDemo.tsx";

type GuidePageProps = {
  guide: Guide;
  onBack: () => void;
};

export function GuidePage({ guide, onBack }: GuidePageProps) {
  const progress = useGuideProgress();
  useEffect(() => {
    progress.markViewed(guide.id);
  }, [guide.id, progress]);

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
        <span className="label">{guide.level}</span>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="heading">{guide.title}</h1>
        <p className="text-sm text-text-muted max-w-prose">{guide.summary}</p>
      </div>
      {guide.sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-2 w-full max-w-prose">
          {section.heading && <h2 className="label">{section.heading}</h2>}
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {section.body}
          </p>
        </div>
      ))}
      {guide.demos.map((demo) => (
        <TechniqueDemo key={demo.id} demo={demo} />
      ))}
      {guide.challenges && guide.challenges.length > 0 && (
        <ChallengePanel challenges={guide.challenges} />
      )}
    </div>
  );
}
