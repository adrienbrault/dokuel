import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useYjsMultiplayer } from "../hooks/useYjsMultiplayer.ts";
import { Lobby } from "./Lobby.tsx";
import { MultiplayerBoard } from "./MultiplayerBoard.tsx";
import { Button } from "./ui/button.tsx";

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

  // Show errors as transient toasts instead of replacing the UI
  useEffect(() => {
    if (mp.error) toast.error(mp.error);
  }, [mp.error]);

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
        {!mp.connected && (
          <DisconnectOverlay
            onClaimWin={() => {
              mp.sendComplete("");
            }}
          />
        )}
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
      </div>
    );
  }

  return null;
}

const DISCONNECT_TIMEOUT = 60;

function DisconnectOverlay({ onClaimWin }: { onClaimWin: () => void }) {
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop">
      <div className="bg-bg-overlay rounded-2xl px-8 py-6 shadow-2xl text-center animate-modal-content">
        <p className="text-lg font-semibold text-text-primary">
          Opponent disconnected
        </p>
        {seconds > 0 ? (
          <p className="caption mt-1">
            Reconnecting...{" "}
            <span className="font-mono tabular-nums">{seconds}s</span>
          </p>
        ) : (
          <Button type="button" className="mt-3" onClick={onClaimWin}>
            Claim Win
          </Button>
        )}
      </div>
    </div>
  );
}
