import { useCallback, useEffect, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import type { AssistLevel, Difficulty, RoomState } from "../lib/types.ts";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "./mp-snapshot.ts";
import { recordRoomMount } from "./mp-telemetry.ts";
import {
  announcePresence,
  claimWinner,
  createRoomFromDoc,
  destroyRoom,
  getOpponentProgress,
  getPlayers,
  getRoomState,
  hydrateRoomFromSnapshot,
  initializeRoom,
  joinRoom,
  leaveRoom,
  MAX_PLAYERS,
  observeRoomChanges,
  type P2PRoom,
  presenceHasOpponent,
  requestRematch,
  setAssistLevel as setRoomAssistLevel,
  setDifficulty as setRoomDifficulty,
  startGame,
  updatePlayerName,
  updateProgress,
} from "./p2p-room.ts";

type UseYjsMultiplayerOptions = {
  roomId: string;
  playerId: string;
  playerName: string;
  difficulty: Difficulty | null;
};

// How long after our own absence ended a remote forfeit claim is still
// honored. Covers the opponent's 60s countdown plus sync latency for
// the case where we return just as their claim lands.
const FORFEIT_TRUST_WINDOW_MS = 120_000;

// Grace window before applying the localStorage snapshot to an empty
// doc: long enough for WebRTC to deliver the live room when a peer is
// up, short enough that a genuine solo restore feels instant-ish.
const HYDRATE_GRACE_MS = 3_000;

// Shape checks for peer-written game content. 81 cells, digits with
// "." holes for a puzzle, digits only for a solution.
const VALID_PUZZLE_RE = /^[1-9.]{81}$/;
const VALID_SOLUTION_RE = /^[1-9]{81}$/;

type OpponentProgress = {
  cellsRemaining: number;
  completionPercent: number;
};

type GameOverInfo = {
  winnerId: string;
  winnerName: string;
};

export function useYjsMultiplayer({
  roomId,
  playerId,
  playerName,
  difficulty,
}: UseYjsMultiplayerOptions) {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [puzzle, setPuzzle] = useState<string | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [opponentProgress, setOpponentProgress] =
    useState<OpponentProgress | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  // Fresh object per raise (not a bare string): consumers toast off
  // this value, and a repeat of the same message must still re-fire
  // their effect.
  const [error, setError] = useState<{ message: string } | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  // True when this client is the odd one out of a full 1v1 room —
  // either it arrived after two players had joined (its joinRoom
  // no-oped), or a concurrent-join merge left three entries and this
  // player sorts into the overflow.
  const [roomFull, setRoomFull] = useState(false);
  // Latched true on first gameNumber > 0 and never cleared. Lets the UI
  // keep rendering the board even if roomState or puzzle momentarily
  // flicker (Yjs sync race, transient peer state), instead of bouncing
  // back to the lobby/connecting screen and unmounting local state.
  const [hasStartedGame, setHasStartedGame] = useState(false);

  const roomRef = useRef<P2PRoom | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const lastGameNumberRef = useRef<number>(0);
  // The puzzle we latched for lastGameNumberRef — lets the observer
  // spot a same-number/different-puzzle merge after a start collision.
  const latchedPuzzleRef = useRef<string | null>(null);
  // One-shot: this client removed its own overflow entry after losing
  // a concurrent-join seat race.
  const evictedSelfRef = useRef(false);
  // Tracks whether this client actually went away (WebRTC dropped for a
  // hidden tab, or the signaling connection fell over). A remote
  // forfeit claim asserts that we did — it is only honored when this
  // record backs it up, otherwise it's the one-liner devtools cheat.
  const absenceRef = useRef<{ ongoing: boolean; endedAt: number }>({
    ongoing: false,
    endedAt: 0,
  });
  // Mirrors the room's current solution so the sendComplete callback
  // (stable identity, created once) can validate claims without a
  // stale closure over the `solution` state.
  const solutionRef = useRef<string | null>(null);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  // Captured at mount so the joiner does not stomp on the host's
  // Yjs difficulty when re-renders happen with a different prop value.
  const initialDifficultyRef = useRef(difficulty);

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

    const doc = new Y.Doc();
    // Persist the doc locally so a tab refresh, brief disconnect, or
    // background tab eviction doesn't lose progress. The `dokuel_`
    // prefix scopes our DBs apart from anything else on the origin.
    const persistence = new IndexeddbPersistence(`dokuel_${roomId}`, doc);
    const provider = new WebrtcProvider(roomId, doc, {
      signaling: ["wss://signal.dokuel.com"],
      maxConns: 4,
      filterBcConns: true,
    });

    const room = createRoomFromDoc(doc, roomId);
    roomRef.current = room;
    providerRef.current = provider;

    const awareness = provider.awareness;

    const updateState = () => {
      const state = getRoomState(room);
      setRoomState(state);
      if (!state) return;
      // Any peer can write anything into the doc; only mirror a
      // solution that is actually a full grid so sendComplete's
      // verification can't be poisoned by garbage.
      if (state.solution === null || VALID_SOLUTION_RE.test(state.solution)) {
        solutionRef.current = state.solution;
      }

      // Detect new game (start or rematch). Content is checked as well
      // as the counter: concurrent starts/rematches write the SAME
      // gameNumber with different puzzles and LWW keeps one — the
      // losing writer latched the number from its own local write, so
      // without the puzzle comparison it would keep a board whose
      // completion never validates against the room's solution.
      // A game is only adopted when its content is shaped like a real
      // board — a peer writing garbage must not brick the client.
      const contentValid =
        state.puzzle !== null &&
        VALID_PUZZLE_RE.test(state.puzzle) &&
        (state.solution === null || VALID_SOLUTION_RE.test(state.solution));
      const isNewGame =
        contentValid && state.gameNumber > lastGameNumberRef.current;
      const isCollidedGame =
        contentValid &&
        !isNewGame &&
        state.gameNumber === lastGameNumberRef.current &&
        state.puzzle !== null &&
        latchedPuzzleRef.current !== null &&
        state.puzzle !== latchedPuzzleRef.current;
      if (isNewGame || isCollidedGame) {
        lastGameNumberRef.current = state.gameNumber;
        latchedPuzzleRef.current = state.puzzle;
        setPuzzle(state.puzzle);
        setSolution(state.solution);
        setGameOver(null);
        setOpponentProgress(null);
        setHasStartedGame(true);
      }

      // Detect winner. A remote solved-claim only counts when the
      // board it ships actually equals the solution — a peer can write
      // anything into the CRDT. A forfeit claim (null board) asserts
      // that WE went away, so it only counts when our own absence
      // record agrees; a fabricated forfeit is ignored and later
      // displaced by our verified solve. Our own claims were validated
      // before writing.
      if (state.winnerId && state.winnerName) {
        const absence = absenceRef.current;
        const forfeitBackedByAbsence =
          absence.ongoing ||
          Date.now() - absence.endedAt < FORFEIT_TRUST_WINDOW_MS;
        const claimValid =
          state.winnerId === playerId ||
          (state.winnerBoard === null
            ? forfeitBackedByAbsence
            : state.winnerBoard === state.solution);
        if (claimValid) {
          setGameOver({
            winnerId: state.winnerId,
            winnerName: state.winnerName,
          });
          clearSnapshot(roomId);
        }
      }

      // Update opponent progress
      const progress = getOpponentProgress(room, playerId);
      if (progress) {
        setOpponentProgress(progress);
      }

      // Excess-player detection: not among the first MAX_PLAYERS
      // (joinRoom no-oped), or sorted into the overflow after a
      // concurrent-join merge.
      const seat = state.players.findIndex((p) => p.id === playerId);
      if (
        state.players.length > MAX_PLAYERS &&
        seat >= MAX_PLAYERS &&
        !evictedSelfRef.current
      ) {
        // We hold an entry but lost the seat race — delete it so the
        // two seated players get their startable lobby back instead of
        // a ghost row and a disabled Start button.
        evictedSelfRef.current = true;
        leaveRoom(room, playerId);
      }
      setRoomFull(
        state.players.length >= MAX_PLAYERS &&
          (seat === -1 || seat >= MAX_PLAYERS),
      );
    };

    const unobserveRoom = observeRoomChanges(room, updateState);

    const updatePresence = () => {
      const hasOpponent = presenceHasOpponent(
        awareness,
        doc.clientID,
        playerId,
        getPlayers(room).length,
      );
      // We drop our own WebRTC on hide (see visibility handler), which
      // clears our awareness — don't blame the opponent for that.
      setOpponentDisconnected(
        !document.hidden && !hasOpponent && getPlayers(room).length > 1,
      );
    };

    awareness.on("change", updatePresence);

    const markAbsent = () => {
      absenceRef.current = { ongoing: true, endedAt: 0 };
    };
    const markPresentAgain = () => {
      if (absenceRef.current.ongoing) {
        absenceRef.current = { ongoing: false, endedAt: Date.now() };
      }
    };

    // Track connection status via provider
    const onStatus = ({ connected: isConnected }: { connected: boolean }) => {
      setConnected(isConnected);
      if (isConnected) {
        markPresentAgain();
      } else {
        markAbsent();
      }
    };
    provider.on("status", onStatus);

    // Also listen for peers to detect when WebRTC connects
    const onPeers = () => {
      updatePresence();
    };
    provider.on("peers", onPeers);

    setConnected(provider.connected);

    // Synchronous localStorage mirror. y-indexeddb writes are async
    // and iOS Safari doesn't always flush them before killing a
    // backgrounded tab — saveSnapshot survives that.
    const persistSnapshot = () => {
      const state = getRoomState(room);
      if (state) saveSnapshot(roomId, state);
    };

    // Release WebRTC peer connections + signaling sockets while the
    // tab is backgrounded: iOS Safari kills tabs under memory pressure
    // and RTCPeerConnections are the dominant cost here. Y.Doc and
    // persistence stay alive across the cycle.
    const HIDE_DEBOUNCE_MS = 15_000;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibility = () => {
      if (document.hidden) {
        persistSnapshot();
        if (hideTimer === null) {
          hideTimer = setTimeout(() => {
            provider.disconnect();
            markAbsent();
            hideTimer = null;
          }, HIDE_DEBOUNCE_MS);
        }
      } else {
        if (hideTimer !== null) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (!provider.connected) {
          provider.connect();
          announcePresence(awareness, playerId, playerNameRef.current);
        }
        markPresentAgain();
      }
      updatePresence();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", persistSnapshot);

    // Defer the writes until y-indexeddb has loaded any persisted
    // state. Writing before sync would seed clock-0 ops (initializeRoom
    // defaults, a fresh player Y.Map from joinRoom) that race the
    // restored state — under iOS Safari's flaky IDB flushes on memory
    // pressure, the doc can resolve back to lobby/gameNumber=0 over
    // several reloads, wiping the in-progress game. Helpers are
    // idempotent so post-sync invocation either seeds an empty room or
    // no-ops one already populated.
    let cancelled = false;
    let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
    let stopHydrateWatch: (() => void) | null = null;
    void persistence.whenSynced.then(() => {
      if (cancelled) return;

      // The creator (came in from the create flow with a chosen
      // difficulty) initializes the room and claims host. Joiners
      // (difficulty=null, came via shared link) skip this and learn
      // host + difficulty from Yjs sync.
      const completeSetup = () => {
        if (cancelled) return;
        const initialDifficulty = initialDifficultyRef.current;
        if (initialDifficulty) {
          initializeRoom(room, playerId, initialDifficulty);
        }
        joinRoom(room, playerId, playerNameRef.current);
        updateState();
      };

      announcePresence(awareness, playerId, playerNameRef.current);

      // If IDB came back without a started game but localStorage has a
      // recent snapshot, restore from it — but not immediately. The
      // snapshot would land in a fresh doc with a new clientID, making
      // every key causally concurrent with the live peer's state, and
      // per-key LWW could roll a finished game back for both players.
      // Give WebRTC a grace window to deliver the real room first; the
      // snapshot only applies when nothing shows up.
      const yjs = getRoomState(room);
      const snap = !yjs || yjs.gameNumber === 0 ? loadSnapshot(roomId) : null;
      if (!snap) {
        completeSetup();
        return;
      }

      const finish = (applySnapshot: boolean) => {
        if (hydrateTimer !== null) {
          clearTimeout(hydrateTimer);
          hydrateTimer = null;
        }
        stopHydrateWatch?.();
        stopHydrateWatch = null;
        if (cancelled) return;
        if (applySnapshot) {
          const current = getRoomState(room);
          if (!current || current.gameNumber === 0) {
            hydrateRoomFromSnapshot(room, snap);
          }
        }
        completeSetup();
      };
      stopHydrateWatch = observeRoomChanges(room, () => {
        const current = getRoomState(room);
        if (current && current.gameNumber > 0) finish(false);
      });
      hydrateTimer = setTimeout(() => {
        hydrateTimer = null;
        finish(true);
      }, HYDRATE_GRACE_MS);
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", persistSnapshot);
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (hydrateTimer !== null) {
        clearTimeout(hydrateTimer);
        hydrateTimer = null;
      }
      stopHydrateWatch?.();
      stopHydrateWatch = null;
      unobserveRoom();
      awareness.off("change", updatePresence);
      provider.off("status", onStatus);
      provider.off("peers", onPeers);
      provider.disconnect();
      provider.destroy();
      persistence.destroy();
      destroyRoom(room);
      roomRef.current = null;
      providerRef.current = null;
    };
    // playerName is intentionally excluded: it's read via playerNameRef
    // inside the effect, and a rename should not tear down the Y.Doc and
    // start a fresh signaling+IDB session. updateName below routes
    // renames through Yjs without remounting.
  }, [roomId, playerId]);

  const sendStartGame = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const players = getPlayers(room);
    if (players.length < 2) {
      setError({ message: "Need 2 players to start" });
      return;
    }
    startGame(room);
  }, []);

  const sendProgress = useCallback(
    (cellsRemaining: number, completionPercent: number) => {
      const room = roomRef.current;
      if (!room) return;
      updateProgress(room, playerId, cellsRemaining, completionPercent);
    },
    [playerId],
  );

  const sendComplete = useCallback(
    (board: string) => {
      const room = roomRef.current;
      if (!room) return;
      // Only a board that actually solves the puzzle may claim. This
      // is client-side honesty, not server enforcement — but it kills
      // the accidental and one-liner cheat paths.
      if (!solutionRef.current || board !== solutionRef.current) return;
      claimWinner(room, playerId, playerNameRef.current, board);
    },
    [playerId],
  );

  // Forfeit path: the opponent's presence dropped and the grace period
  // ran out. Distinct from sendComplete so an unfinished board is never
  // disguised as a solve.
  const claimForfeitWin = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    // Recheck at claim time: the countdown was armed from stale state
    // and the opponent may have reconnected in the meantime — don't
    // steamroll a player who just came back.
    const provider = providerRef.current;
    if (
      provider &&
      presenceHasOpponent(
        provider.awareness,
        room.doc.clientID,
        playerId,
        getPlayers(room).length,
      )
    ) {
      return;
    }
    claimWinner(room, playerId, playerNameRef.current, null);
  }, [playerId]);

  const sendRematch = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    requestRematch(room);
  }, []);

  const updateName = useCallback(
    (newName: string) => {
      const room = roomRef.current;
      if (!room) return;
      updatePlayerName(room, playerId, newName);

      // Update awareness too
      const provider = providerRef.current;
      if (provider) {
        announcePresence(provider.awareness, playerId, newName);
      }
    },
    [playerId],
  );

  const setAssistLevel = useCallback((level: AssistLevel) => {
    const room = roomRef.current;
    if (!room) return;
    setRoomAssistLevel(room, level);
  }, []);

  const setDifficulty = useCallback((level: Difficulty) => {
    const room = roomRef.current;
    if (!room) return;
    setRoomDifficulty(room, level);
  }, []);

  return {
    connected,
    roomState,
    puzzle,
    solution,
    opponentProgress,
    opponentDisconnected,
    gameOver,
    hasStartedGame,
    roomFull,
    error,
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
