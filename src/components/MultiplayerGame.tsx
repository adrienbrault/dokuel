import { useEffect, useState } from "react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.ts";
import { useYjsMultiplayer } from "../hooks/useYjsMultiplayer.ts";
import { Lobby } from "./Lobby.tsx";
import { MultiplayerBoard } from "./MultiplayerBoard.tsx";
import { Toast } from "./Toast.tsx";

type MultiplayerGameProps = {
  playerId: string;
  playerName: string;
  roomId: string;
  difficulty: import("../lib/types.ts").Difficulty | null;
  onRename?: (name: string) => void;
  onBack: () => void;
};

export function MultiplayerGame({
  playerId,
  playerName,
  roomId,
  difficulty,
  onRename,
  onBack,
}: MultiplayerGameProps) {
  const mp = useYjsMultiplayer({ roomId, playerId, playerName, difficulty });
  const [toast, setToast] = useState<string | null>(null);
  // Arms after the disconnect has persisted for a beat; combined with
  // the live value below so the banner hides instantly on return.
  const disconnectSettled = useDelayedFlag(
    mp.opponentDisconnected && !mp.gameOver,
    2_000,
  );

  // Show errors as transient toasts instead of replacing the UI. The
  // hook raises a fresh object per error, so a repeat of the same
  // message re-fires this effect and the toast shows again.
  useEffect(() => {
    if (!mp.error) return;
    setToast(mp.error.message);
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [mp.error]);

  if (mp.roomFull) {
    return (
      <div className="screen">
        <div className="screen-content flex flex-col items-center justify-center gap-4 text-center min-h-dvh">
          <h1 className="heading">Game is full</h1>
          <p className="caption max-w-sm">
            This room already has two players. Ask your friend for a new invite,
            or create your own game.
          </p>
          <button
            type="button"
            className="btn btn-lg btn-primary"
            onClick={onBack}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // Once we've started a game and have a puzzle, keep the board mounted
  // even if mp.roomState or mp.puzzle briefly flicker during Yjs sync —
  // the local board state (cells, notes, progress) lives in
  // MultiplayerBoard and would be wiped by an unmount.
  if (mp.hasStartedGame && mp.puzzle) {
    const opponent = mp.roomState?.players.find((p) => p.id !== playerId);
    return (
      <>
        <MultiplayerBoard
          roomId={roomId}
          puzzle={mp.puzzle}
          solution={mp.solution}
          gameNumber={mp.roomState?.gameNumber ?? 0}
          playerId={playerId}
          difficulty={mp.roomState?.difficulty ?? "medium"}
          assistLevel={mp.roomState?.assistLevel ?? "standard"}
          opponentName={opponent?.name ?? ""}
          opponentProgress={mp.opponentProgress}
          opponentDisconnected={mp.opponentDisconnected}
          gameOver={mp.gameOver}
          onProgress={mp.sendProgress}
          onComplete={mp.sendComplete}
          onRematch={mp.sendRematch}
          onBack={onBack}
        />
        {/* opponentDisconnected is awareness-based — the only signal
            that reflects the opponent. provider.connected is local
            intent and goes false on our own tab-hide teardown. The
            delay swallows the re-sync moment right after OUR return
            from a backgrounded tab, and the live && hides the banner
            the instant the opponent is back. */}
        {disconnectSettled && mp.opponentDisconnected && !mp.gameOver && (
          <DisconnectBanner onClaimWin={mp.claimForfeitWin} />
        )}
        {toast && <Toast message={toast} />}
      </>
    );
  }

  if (!mp.roomState) {
    return (
      <div className="screen">
        <p className="caption">Connecting...</p>
      </div>
    );
  }

  if (!mp.puzzle && mp.roomState.status === "lobby") {
    return (
      <div className="screen">
        <Lobby
          roomState={mp.roomState}
          playerId={playerId}
          onRename={(name) => {
            if (onRename) onRename(name);
            mp.updateName(name);
          }}
          onAssistLevelChange={mp.setAssistLevel}
          onDifficultyChange={mp.setDifficulty}
          onStart={mp.sendStartGame}
          onBack={onBack}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  return null;
}

const DISCONNECT_TIMEOUT = 60;

/**
 * Non-blocking notice while the opponent's presence is gone. The spec's
 * grace period is exactly when the still-connected player wants to race
 * ahead, so the board must stay fully playable underneath — this is a
 * status banner pinned to the top, never a modal.
 */
function DisconnectBanner({ onClaimWin }: { onClaimWin: () => void }) {
  const [seconds, setSeconds] = useState(DISCONNECT_TIMEOUT);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-bg-overlay px-5 py-2.5 shadow-lg border border-border-default animate-modal-content"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <p className="text-sm font-semibold text-text-primary whitespace-nowrap">
        Opponent disconnected
      </p>
      {seconds > 0 ? (
        <p className="caption whitespace-nowrap">
          <span className="font-mono tabular-nums">{seconds}s</span>
        </p>
      ) : (
        <button
          type="button"
          className="btn btn-md btn-primary"
          onClick={onClaimWin}
        >
          Claim Win
        </button>
      )}
    </div>
  );
}
