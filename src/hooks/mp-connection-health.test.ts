import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { watchConnectionHealth } from "./mp-connection-health.ts";

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
});
