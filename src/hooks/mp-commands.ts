import { type RefObject, useCallback } from "react";
import type { ReplayFrame } from "../lib/replay.ts";
import type { AssistLevel, Difficulty, DigitStyle } from "../lib/types.ts";
import type { Connection } from "./mp-connection.ts";
import type { Room } from "./mp-room.ts";

/**
 * Every write the UI is allowed to make, bound to whichever Room and
 * Connection are live at call time.
 *
 * They read through refs rather than closing over values: the Room is
 * rebuilt whenever the transport reopens, and a callback identity that
 * changed with it would re-render the whole game tree on every
 * reconnect. A command that fires before the Room exists is dropped,
 * not queued — there is nothing yet for it to be true about.
 */
export function useRoomCommands({
  roomRef,
  connectionRef,
  playerId,
}: {
  roomRef: RefObject<Room | null>;
  connectionRef: RefObject<Connection | null>;
  playerId: string;
}) {
  const sendStartGame = useCallback(() => {
    roomRef.current?.start();
  }, [roomRef]);

  const sendProgress = useCallback(
    (cellsRemaining: number, completionPercent: number) => {
      roomRef.current?.progress(cellsRemaining, completionPercent);
    },
    [roomRef],
  );

  const sendComplete = useCallback(
    (board: string) => {
      roomRef.current?.complete(board);
    },
    [roomRef],
  );

  // Forfeit path: the opponent's presence dropped and the grace period
  // ran out. Distinct from sendComplete so an unfinished board is never
  // disguised as a solve.
  const claimForfeitWin = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    // Presence is re-read here, not taken from the Room's last event:
    // the countdown was armed from stale state and the opponent may
    // have reconnected in the meantime.
    const connection = connectionRef.current;
    room.claimForfeit({
      hasOtherPeer: connection?.hasOtherPeer(playerId) ?? false,
    });
  }, [roomRef, connectionRef, playerId]);

  const sendRematch = useCallback(() => {
    roomRef.current?.rematch();
  }, [roomRef]);

  const updateName = useCallback(
    (newName: string) => {
      const room = roomRef.current;
      if (!room) return;
      room.updateName(newName);
      // Presence carries the name too, and that lives on the Connection.
      connectionRef.current?.announce({ id: playerId, name: newName });
    },
    [roomRef, connectionRef, playerId],
  );

  const setAssistLevel = useCallback(
    (level: AssistLevel) => {
      roomRef.current?.setAssistLevel(level);
    },
    [roomRef],
  );

  const setDifficulty = useCallback(
    (level: Difficulty) => {
      roomRef.current?.setDifficulty(level);
    },
    [roomRef],
  );

  const setDigitStyle = useCallback(
    (style: DigitStyle | null) => {
      roomRef.current?.setDigitStyle(style);
    },
    [roomRef],
  );

  const sendReplay = useCallback(
    (frames: ReplayFrame[]) => {
      roomRef.current?.publishReplay(frames);
    },
    [roomRef],
  );

  return {
    sendStartGame,
    sendReplay,
    sendProgress,
    sendComplete,
    claimForfeitWin,
    sendRematch,
    updateName,
    setAssistLevel,
    setDigitStyle,
    setDifficulty,
  };
}
