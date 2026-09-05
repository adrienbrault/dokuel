import type { FriendChallenge } from "../lib/challenge.ts";
import { challengeGameKey, compareChallenge } from "../lib/challenge.ts";
import { hashCode } from "../lib/daily.ts";
import { formatTime } from "../lib/format.ts";
import {
  createFriendReceipt,
  createFriendRoundChallenge,
  type FriendRoundPlan,
} from "../lib/friend-receipt.ts";
import type { GameCompletionResult } from "../lib/game-completion.ts";
import type { Difficulty, NumPadPosition } from "../lib/types.ts";
import { GameResult } from "./GameResult.tsx";

type SoloGameResultProps = {
  elapsedSeconds: number;
  difficulty: Difficulty;
  puzzle: string;
  challenge?: FriendChallenge | undefined;
  friendRound?: FriendRoundPlan | undefined;
  gameKey?: string | undefined;
  completion: GameCompletionResult | null;
  hintsUsed: number;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
  isDaily: boolean;
  tipDismissed: boolean;
  position: NumPadPosition;
  onNewGame: () => void;
  onRematch?: (() => void) | undefined;
  persistenceError?: boolean | undefined;
  onRetryPersistence?: (() => void) | undefined;
  onDismissTip: () => void;
};

export function SoloGameResult({
  elapsedSeconds,
  difficulty,
  puzzle,
  challenge,
  friendRound,
  gameKey,
  completion,
  hintsUsed,
  streakInfo,
  isDaily,
  tipDismissed,
  position,
  onNewGame,
  onRematch,
  persistenceError,
  onRetryPersistence,
  onDismissTip,
}: SoloGameResultProps) {
  const displayTimeSeconds =
    completion?.timeSeconds ?? Math.floor(elapsedSeconds);
  return (
    <GameResult
      isWinner={true}
      time={formatTime(displayTimeSeconds)}
      timeSeconds={displayTimeSeconds}
      difficulty={difficulty}
      onNewGame={onNewGame}
      onRematch={onRematch}
      shareChallenge={
        completion
          ? friendRound
            ? createFriendRoundChallenge(
                friendRound,
                puzzle,
                completion.timeSeconds,
                completion.assistLevel,
                hintsUsed,
              )
            : {
                version: 1,
                puzzle,
                difficulty,
                assistLevel: completion.assistLevel,
                timeSeconds: completion.timeSeconds,
                hintsUsed,
              }
          : undefined
      }
      shareReceipt={
        challenge && completion
          ? createFriendReceipt({
              matchId: `friend-${hashCode(`${challengeGameKey(challenge)}:${gameKey ?? ""}`)}`,
              challenge,
              friendTimeSeconds: displayTimeSeconds,
              friendAssistLevel: completion.assistLevel,
              friendHintsUsed: hintsUsed,
            })
          : undefined
      }
      comparison={
        challenge && completion
          ? compareChallenge(challenge, {
              ...completion,
              hintsUsed,
            })
          : undefined
      }
      stats={completion?.stats ?? null}
      isNewPB={completion?.isNewPB}
      persistenceError={persistenceError}
      onRetryPersistence={onRetryPersistence}
      hintsUsed={hintsUsed}
      streakInfo={streakInfo}
      isDaily={isDaily}
      tip={
        !tipDismissed && position === "bottom"
          ? "Tip: Move the numpad to the side for faster two-finger play! Open settings (gear icon) to try it."
          : undefined
      }
      onDismissTip={onDismissTip}
    />
  );
}
