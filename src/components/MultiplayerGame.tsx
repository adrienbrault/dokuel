import { useEffect, useState } from "react";
import { useYjsMultiplayer } from "../hooks/useYjsMultiplayer.ts";
import { Lobby } from "./Lobby.tsx";
import { MultiplayerBoard } from "./MultiplayerBoard.tsx";
import { Toast } from "./Toast.tsx";

type MultiplayerGameProps = {
  playerId: string;
  playerName: string;
  roomId: string;
  difficulty: import("../lib/types.ts").Difficulty;
  onRename?: (name: string) => void;
  onBack: () => void;
  onAddFriend?:
    | ((opponentId: string, opponentName: string) => void)
    | undefined;
};

export function MultiplayerGame({
  playerId,
  playerName,
  roomId,
  difficulty,
  onRename,
  onBack,
  onAddFriend,
}: MultiplayerGameProps) {
  const mp = useYjsMultiplayer({ roomId, playerId, playerName, difficulty });
  const [toast, setToast] = useState<string | null>(null);

  // Show errors as transient toasts instead of replacing the UI
  useEffect(() => {
    if (!mp.error) return;
    setToast(mp.error);
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [mp.error]);

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
          onStart={mp.sendStartGame}
          onBack={onBack}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (mp.puzzle) {
    const opponent = mp.roomState?.players.find((p) => p.id !== playerId);
    return (
      <>
        <MultiplayerBoard
          key={mp.puzzle}
          puzzle={mp.puzzle}
          playerId={playerId}
          difficulty={difficulty}
          assistLevel={mp.roomState?.assistLevel ?? "standard"}
          opponentProgress={mp.opponentProgress}
          opponentDisconnected={mp.opponentDisconnected}
          gameOver={mp.gameOver}
          onProgress={mp.sendProgress}
          onComplete={mp.sendComplete}
          onRematch={mp.sendRematch}
          onBack={onBack}
          onAddFriend={onAddFriend}
          opponentId={opponent?.id}
          opponentName={opponent?.name}
        />
        {!mp.connected && (
          <DisconnectOverlay
            onClaimWin={() => {
              mp.sendComplete("");
            }}
          />
        )}
        {toast && <Toast message={toast} />}
      </>
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
          <button
            type="button"
            className="btn btn-md btn-primary mt-3"
            onClick={onClaimWin}
          >
            Claim Win
          </button>
        )}
      </div>
    </div>
  );
}
