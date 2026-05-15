import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("y-webrtc", () => {
  class FakeWebrtcProvider {
    awareness = {
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getStates: () => new Map(),
    };
    connected = false;
    on() {}
    off() {}
    disconnect() {}
    destroy() {}
  }
  return { WebrtcProvider: FakeWebrtcProvider };
});

const { useYjsMultiplayer } = await import("./useYjsMultiplayer.ts");

describe("useYjsMultiplayer", () => {
  it("host writes chosen difficulty to Yjs on mount", () => {
    const { result } = renderHook(() =>
      useYjsMultiplayer({
        roomId: "abc123",
        playerId: "p1",
        playerName: "Alice",
        difficulty: "expert",
      }),
    );

    expect(result.current.roomState?.difficulty).toBe("expert");
  });
});
