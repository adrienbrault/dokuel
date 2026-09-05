import { describe, expect, it } from "vitest";
import {
  challengeQuery,
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
