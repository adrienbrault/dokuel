import { describe, expect, it } from "vitest";
import { decodeChallenge, encodeChallenge } from "./challenge.ts";
import type { Challenge } from "./types.ts";

const fixture: Challenge = {
  v: 1,
  puzzle:
    "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
  difficulty: "medium",
  assistLevel: "standard",
  challengerName: "clever-otter",
  finalTime: 272,
  hintsUsed: 0,
  ghost: [
    { t: 0, p: 0 },
    { t: 30, p: 20 },
    { t: 120, p: 60 },
    { t: 272, p: 100 },
  ],
};

describe("encodeChallenge / decodeChallenge", () => {
  it("round-trips a challenge through encode and decode", async () => {
    const blob = await encodeChallenge(fixture);
    expect(await decodeChallenge(blob)).toEqual(fixture);
  });

  it("produces a URL-safe blob", async () => {
    const blob = await encodeChallenge(fixture);
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null for a non-base64url blob", async () => {
    expect(await decodeChallenge("!!! not a blob !!!")).toBeNull();
  });

  it("returns null when the bytes are not valid gzip", async () => {
    // "hello" base64-encoded — decodes fine but is not a gzip stream.
    expect(await decodeChallenge("aGVsbG8")).toBeNull();
  });

  it("returns null for an unknown schema version", async () => {
    const blob = await encodeChallenge({
      ...fixture,
      v: 2,
    } as unknown as Challenge);
    expect(await decodeChallenge(blob)).toBeNull();
  });

  it("returns null for a structurally invalid puzzle", async () => {
    const blob = await encodeChallenge({
      ...fixture,
      puzzle: "too short",
    } as unknown as Challenge);
    expect(await decodeChallenge(blob)).toBeNull();
  });

  it("returns null for an empty ghost timeline", async () => {
    const blob = await encodeChallenge({ ...fixture, ghost: [] });
    expect(await decodeChallenge(blob)).toBeNull();
  });
});
