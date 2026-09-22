import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { Doc } from "yjs";
import { recordTelemetry } from "../lib/telemetry.fake.ts";
import {
  createFakeConnections,
  type FakeConnection,
} from "./mp-connection.fake.ts";
import {
  CONNECT_TIMEOUT_MS,
  type ConnectionRole,
  watchConnectionHealth,
} from "./mp-connection-health.ts";

/** Play the opponent: merge a remote client's announced presence. */
function opponentAnnounces(connection: FakeConnection) {
  const remote = new Awareness(new Doc());
  remote.setLocalState({ user: { id: "p2", name: "Bob" } });
  applyAwarenessUpdate(
    connection.awareness,
    encodeAwarenessUpdate(remote, [remote.clientID]),
    "remote",
  );
}

let telemetry: ReturnType<typeof recordTelemetry>;
let clock: number;
const now = () => clock;

beforeEach(() => {
  telemetry = recordTelemetry();
  clock = 1_000;
});
afterEach(() => {
  telemetry.stop();
});

async function openFake(): Promise<FakeConnection> {
  const connections = createFakeConnections();
  await connections.open("room-health");
  return connections.last as FakeConnection;
}

describe("watchConnectionHealth", () => {
  it("reports the time from opening to the first reachable peer, once", async () => {
    const connection = await openFake();
    const stop = watchConnectionHealth(connection, {
      playerId: "p1",
      role: "joiner",
      openedAt: 1_000,
      now,
    });

    clock = 3_500;
    opponentAnnounces(connection);
    clock = 9_000;
    connection.emitPresence();

    expect(telemetry.events()).toEqual([{ name: "mp_first_peer", ms: 2_500 }]);
    stop();
  });

  it("reports the candidate types the first peer connected over", async () => {
    const connection = await openFake();
    connection.iceRoute = () =>
      Promise.resolve({ local: "relay", remote: "srflx" });
    const stop = watchConnectionHealth(connection, {
      playerId: "p1",
      role: "joiner",
      openedAt: 1_000,
      now,
    });

    opponentAnnounces(connection);
    await Promise.resolve();

    expect(
      telemetry.events().filter((event) => event.name === "mp_ice_route"),
    ).toEqual([{ name: "mp_ice_route", local: "relay", remote: "srflx" }]);
    stop();
  });

  describe("when no peer shows up in time", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    type Setup = {
      role: ConnectionRole;
      signaling: boolean;
      peer?: boolean;
      hidden?: boolean;
    };

    it.each<[string, Setup, string | null]>([
      [
        "a joiner that never reached signaling",
        { role: "joiner", signaling: false },
        "signaling_timeout",
      ],
      [
        "a creator that never reached signaling",
        { role: "creator", signaling: false },
        "signaling_timeout",
      ],
      [
        "a joiner on signaling with no peer",
        { role: "joiner", signaling: true },
        "peer_timeout",
      ],
      // A creator waiting for a friend to open the link is not a
      // failure, however long it takes.
      ["a creator waiting alone", { role: "creator", signaling: true }, null],
      [
        "a joiner whose peer arrived",
        { role: "joiner", signaling: true, peer: true },
        null,
      ],
      // A backgrounded tab drops its own transport on purpose.
      [
        "a hidden tab",
        { role: "joiner", signaling: false, hidden: true },
        null,
      ],
    ])("reports %s", async (_label, setup, reason) => {
      const connection = await openFake();
      connection.connected = setup.signaling;
      vi.spyOn(document, "hidden", "get").mockReturnValue(
        setup.hidden ?? false,
      );
      const stop = watchConnectionHealth(connection, {
        playerId: "p1",
        role: setup.role,
        openedAt: 1_000,
        now,
      });
      if (setup.peer) opponentAnnounces(connection);

      clock = 1_000 + CONNECT_TIMEOUT_MS;
      vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);

      expect(
        telemetry
          .events()
          .filter((event) => event.name === "mp_connect_failed"),
      ).toEqual(
        reason
          ? [
              {
                name: "mp_connect_failed",
                reason,
                role: setup.role,
                ms: CONNECT_TIMEOUT_MS,
              },
            ]
          : [],
      );
      stop();
    });
  });
});
