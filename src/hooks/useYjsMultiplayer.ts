import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import type { OpenConnection } from "./mp-connection.ts";
import { openWebrtcConnection } from "./mp-connection.webrtc.ts";
import { INITIAL_PROJECTION } from "./mp-room.ts";
import {
  createRoomSession,
  type RoomSession,
  type RoomSessionSnapshot,
} from "./mp-session.ts";
import { recordRoomMount } from "./mp-telemetry.ts";

/**
 * React binding for a {@link ./mp-session.ts room session}: it renders
 * the session's snapshot, forwards the two DOM events the session
 * cannot see for itself, and closes the session on unmount. Every
 * decision — what to do about a hidden tab, when to reconnect, what a
 * command means — belongs to the session.
 */

const INITIAL_SNAPSHOT: RoomSessionSnapshot = {
  ...INITIAL_PROJECTION,
  connected: false,
};

type UseYjsMultiplayerOptions = {
  roomId: string;
  playerId: string;
  playerName: string;
  difficulty: Difficulty | null;
  /**
   * Transport adapter. Defaults to the production WebRTC/IndexedDB one;
   * tests inject the in-memory adapter from ./mp-connection.fake.ts.
   */
  openConnection?: OpenConnection;
};

export function useYjsMultiplayer({
  roomId,
  playerId,
  playerName,
  difficulty,
  openConnection = openWebrtcConnection,
}: UseYjsMultiplayerOptions) {
  // One value for everything the session projects: it keeps its
  // identity stable across no-op doc fires, so React bails out of the
  // re-render without the hook comparing anything.
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);

  const sessionRef = useRef<RoomSession | null>(null);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  // Captured at mount so the joiner does not stomp on the host's
  // difficulty when re-renders happen with a different prop value.
  const initialDifficultyRef = useRef(difficulty);
  // Read through a ref for the same reason as playerName: swapping the
  // adapter mid-room is not a thing, and a caller passing an inline
  // factory must not tear the room down on every render.
  const openConnectionRef = useRef(openConnection);
  openConnectionRef.current = openConnection;

  useEffect(() => {
    // Self-diagnostic for the iOS Safari reload problem. Visible to
    // anyone with Safari Web Inspector access; surfaced as a console
    // warn when the same room mounts more than once in an hour.
    const mountCount = recordRoomMount(roomId);
    if (mountCount > 1) {
      console.warn(
        `[dokuel] mp room ${roomId} mounted ${mountCount}× in last hour`,
      );
    }

    const session = createRoomSession({
      roomId,
      playerId,
      playerName: () => playerNameRef.current,
      initialDifficulty: initialDifficultyRef.current,
      openConnection: openConnectionRef.current,
    });
    sessionRef.current = session;

    const unsubscribe = session.subscribe(() => {
      setSnapshot(session.snapshot());
    });

    const handleVisibility = () => {
      session.visibilityChanged(document.hidden);
    };
    const handlePageHide = () => {
      session.pageHidden();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      unsubscribe();
      session.close();
      sessionRef.current = null;
    };
    // playerName is intentionally excluded: it's read via playerNameRef
    // inside the effect, and a rename should not tear down the Y.Doc and
    // start a fresh signaling+IDB session. updateName below routes
    // renames through Yjs without remounting.
  }, [roomId, playerId]);

  const sendStartGame = useCallback(() => {
    sessionRef.current?.start();
  }, []);

  const sendProgress = useCallback(
    (cellsRemaining: number, completionPercent: number) => {
      sessionRef.current?.progress(cellsRemaining, completionPercent);
    },
    [],
  );

  const sendComplete = useCallback((board: string) => {
    sessionRef.current?.complete(board);
  }, []);

  // Forfeit path: the opponent's presence dropped and the grace period
  // ran out. Distinct from sendComplete so an unfinished board is never
  // disguised as a solve.
  const claimForfeitWin = useCallback(() => {
    sessionRef.current?.claimForfeit();
  }, []);

  const sendRematch = useCallback(() => {
    sessionRef.current?.rematch();
  }, []);

  const updateName = useCallback((newName: string) => {
    sessionRef.current?.updateName(newName);
  }, []);

  const setAssistLevel = useCallback((level: AssistLevel) => {
    sessionRef.current?.setAssistLevel(level);
  }, []);

  const setDifficulty = useCallback((level: Difficulty) => {
    sessionRef.current?.setDifficulty(level);
  }, []);

  return {
    ...snapshot,
    sendStartGame,
    sendProgress,
    sendComplete,
    claimForfeitWin,
    sendRematch,
    updateName,
    setAssistLevel,
    setDifficulty,
  };
}
