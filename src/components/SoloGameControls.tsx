import type { SaveStatus } from "../hooks/useResumableSudoku.ts";
import {
  canPractiseTechnique,
  type LearningExerciseData,
} from "../lib/learning-exercises.ts";
import { recordTechniquePractice } from "../lib/learning-progress.ts";
import type { ActiveHint } from "../lib/types.ts";
import { GameControls } from "./GameControls.tsx";
import { HintBanner } from "./HintBanner.tsx";
import { LearningExercise } from "./LearningExercise.tsx";

type SoloGameControlsProps = {
  saveStatus: SaveStatus;
  onRetrySave: () => void;
  activeHint: ActiveHint | null;
  learningExercise: LearningExerciseData | null;
  onDismissHint: () => void;
  onAdvanceHint: () => void;
  onPractice: () => void;
  onClosePractice: () => void;
  notesMode: boolean;
  onToggleNotes: () => void;
  disabled: boolean;
  onErase: () => void;
  onUndo: () => void;
  historyLength: number;
  onHint: () => void;
};

export function SoloGameControls({
  saveStatus,
  onRetrySave,
  activeHint,
  learningExercise,
  onDismissHint,
  onAdvanceHint,
  onPractice,
  onClosePractice,
  notesMode,
  onToggleNotes,
  disabled,
  onErase,
  onUndo,
  historyLength,
  onHint,
}: SoloGameControlsProps) {
  return (
    <>
      {saveStatus === "failed" && (
        <div
          role="status"
          className="card flex flex-col items-center gap-2 p-3 text-center"
        >
          <p className="text-sm text-negative-text">
            Progress could not be saved. Keep playing and try again.
          </p>
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={onRetrySave}
          >
            Try saving again
          </button>
        </div>
      )}
      {activeHint && (
        <HintBanner
          hint={activeHint}
          onDismiss={onDismissHint}
          onAdvance={onAdvanceHint}
          onPractice={
            canPractiseTechnique(activeHint.technique) ? onPractice : undefined
          }
        />
      )}
      {learningExercise && (
        <LearningExercise
          technique={learningExercise.technique}
          puzzle={learningExercise.puzzle}
          position={learningExercise.position}
          prompt={learningExercise.prompt}
          answer={learningExercise.answer}
          onSolved={() => {}}
          onAttempt={recordTechniquePractice}
          onClose={onClosePractice}
        />
      )}
      <GameControls
        notesMode={notesMode}
        onToggleNotes={onToggleNotes}
        disabled={disabled}
        onErase={onErase}
        onUndo={onUndo}
        historyLength={historyLength}
        onHint={onHint}
      />
    </>
  );
}
