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
  showConflicts?: boolean;
  onBack: () => void;
};

export function MultiplayerGame({
  playerId,
  playerName,
  roomId,
  difficulty,
  showConflicts = true,
  onBack,
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
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
        <p className="text-gray-500 dark:text-gray-400">Connecting...</p>
      </div>
    );
  }

  if (!mp.puzzle && mp.roomState.status === "lobby") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
        <Lobby
          roomState={mp.roomState}
          onStart={mp.sendStartGame}
          onBack={onBack}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (mp.puzzle) {
    return (
      <>
        <MultiplayerBoard
          puzzle={mp.puzzle}
          playerId={playerId}
          difficulty={difficulty}
          showConflicts={showConflicts}
          opponentProgress={mp.opponentProgress}
          opponentDisconnected={mp.opponentDisconnected}
          gameOver={mp.gameOver}
          onProgress={mp.sendProgress}
          onComplete={mp.sendComplete}
          onRematch={mp.sendRematch}
          onBack={onBack}
        />
        {!mp.connected && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop">
            <div className="bg-white dark:bg-gray-900 rounded-2xl px-8 py-6 shadow-2xl text-center animate-modal-content">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Reconnecting...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Please wait
              </p>
            </div>
          </div>
        )}
        {toast && <Toast message={toast} />}
      </>
    );
  }

  return null;
}
