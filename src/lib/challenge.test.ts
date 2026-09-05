import { describe, expect, it } from "vitest";
import {
  buildChallengeShareText,
  buildChallengeUrl,
  challengeQuery,
  describeChallengeOutcome,
  parseChallenge,
  type SoloChallenge,
} from "./challenge.ts";

describe("parseChallenge", () => {
  it("reads the time and challenger from a link's query", () => {
    expect(parseChallenge("?t=252&by=Swift+Panda")).toEqual({
      time: 252,
      by: "Swift Panda",
    });
  });

  it("drops a challenge whose time is not a positive whole number", () => {
    for (const search of ["?t=0&by=Ann", "?t=-5&by=Ann", "?t=4.5&by=Ann"]) {
      expect(parseChallenge(search)).toBeNull();
    }
  });

  it("drops a challenge with no challenger, or an implausibly long one", () => {
    expect(parseChallenge("?t=252")).toBeNull();
    expect(parseChallenge("?t=252&by=")).toBeNull();
    expect(parseChallenge(`?t=252&by=${"a".repeat(41)}`)).toBeNull();
  });

  it("ignores unrelated query params", () => {
    expect(parseChallenge("?utm=x&t=60&by=Ann&ref=y")).toEqual({
      time: 60,
      by: "Ann",
    });
  });
});

describe("challengeQuery", () => {
  it("round-trips a challenge through parseChallenge", () => {
    const challenge: SoloChallenge = { time: 252, by: "Swift Panda" };
    expect(parseChallenge(challengeQuery(challenge))).toEqual(challenge);
  });

  it("is empty when there is no challenge", () => {
    expect(challengeQuery(undefined)).toBe("");
  });
});

describe("buildChallengeUrl", () => {
  it("addresses the same seeded board and carries the time and name", () => {
    expect(
      buildChallengeUrl({
        difficulty: "medium",
        gameKey: "abc123",
        timeSeconds: 252,
        by: "Swift Panda",
      }),
    ).toBe("https://dokuel.com/solo/medium/abc123?t=252&by=Swift+Panda");
  });

  it("clamps a long name so the receiver still reads a challenge", () => {
    const url = buildChallengeUrl({
      difficulty: "easy",
      gameKey: "abc123",
      timeSeconds: 60,
      by: "M".repeat(60),
    });
    expect(parseChallenge(new URL(url).search)).toEqual({
      time: 60,
      by: "M".repeat(40),
    });
  });
});

describe("buildChallengeShareText", () => {
  it("states the difficulty, the time and the link", () => {
    expect(
      buildChallengeShareText({
        difficulty: "medium",
        time: "04:12",
        url: "https://dokuel.com/solo/medium/abc123?t=252&by=Ann",
      }),
    ).toBe(
      "I solved this Medium sudoku in 04:12. Beat my time!\nhttps://dokuel.com/solo/medium/abc123?t=252&by=Ann",
    );
  });
});

describe("describeChallengeOutcome", () => {
  const challenge = { time: 252, by: "Swift Panda" };

  it("celebrates a faster finish and states the margin", () => {
    expect(describeChallengeOutcome(challenge, 205)).toEqual({
      beaten: true,
      headline: "You beat Swift Panda's 04:12!",
      delta: "00:47 faster",
    });
  });

  it("reports a slower finish and how far behind it landed", () => {
    expect(describeChallengeOutcome(challenge, 300)).toEqual({
      beaten: false,
      headline: "Swift Panda was faster: 04:12",
      delta: "00:48 behind",
    });
  });

  it("calls an identical time a dead heat", () => {
    expect(describeChallengeOutcome(challenge, 252)).toEqual({
      beaten: false,
      headline: "Dead heat with Swift Panda at 04:12",
      delta: "",
    });
  });
});
