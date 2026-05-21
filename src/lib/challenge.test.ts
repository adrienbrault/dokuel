import { describe, expect, it } from "vitest";
import {
  buildChallengeUrl,
  decodeChallenge,
  encodeChallenge,
  ghostPercentAt,
  parseChallengeUrl,
} from "./challenge.ts";
import type { Challenge, GhostSample } from "./types.ts";

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

describe("ghostPercentAt", () => {
  const samples: GhostSample[] = [
    { t: 0, p: 0 },
    { t: 10, p: 50 },
    { t: 20, p: 100 },
  ];

  it("clamps to 0 before and at the first sample", () => {
    expect(ghostPercentAt(samples, -5)).toBe(0);
    expect(ghostPercentAt(samples, 0)).toBe(0);
  });

  it("clamps to 100 at and after the last sample", () => {
    expect(ghostPercentAt(samples, 20)).toBe(100);
    expect(ghostPercentAt(samples, 99)).toBe(100);
  });

  it("returns the exact value at a sample point", () => {
    expect(ghostPercentAt(samples, 10)).toBe(50);
  });

  it("linearly interpolates between bracketing samples", () => {
    expect(ghostPercentAt(samples, 5)).toBe(25);
    expect(ghostPercentAt(samples, 15)).toBe(75);
  });

  it("handles a single-sample timeline", () => {
    expect(ghostPercentAt([{ t: 0, p: 0 }], 42)).toBe(0);
  });
});

describe("buildChallengeUrl / parseChallengeUrl", () => {
  it("round-trips a challenge through a shareable URL", async () => {
    const url = await buildChallengeUrl(fixture);
    expect(url).toContain("/challenge#");
    const { pathname, hash } = new URL(url);
    expect(await parseChallengeUrl({ pathname, hash })).toEqual(fixture);
  });

  it("returns null when the path is not the challenge route", async () => {
    const blob = await encodeChallenge(fixture);
    expect(
      await parseChallengeUrl({ pathname: "/some-room", hash: `#${blob}` }),
    ).toBeNull();
  });

  it("returns null when the hash is empty", async () => {
    expect(
      await parseChallengeUrl({ pathname: "/challenge", hash: "" }),
    ).toBeNull();
  });

  it("returns null for an undecodable blob", async () => {
    expect(
      await parseChallengeUrl({ pathname: "/challenge", hash: "#not-a-blob!" }),
    ).toBeNull();
  });
});
