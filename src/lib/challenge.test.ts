// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_CHALLENGE_SECONDS,
  MAX_CHALLENGER_NAME_LENGTH,
  parseChallenge,
} from "./challenge.ts";

describe("parseChallenge", () => {
  it("reads the challenger's time and name from the query string", () => {
    expect(parseChallenge("?t=272&by=Swift%20Fox")).toEqual({
      seconds: 272,
      name: "Swift Fox",
      hinted: false,
    });
  });

  it.each([
    ["no query at all", ""],
    ["a missing time", "?by=Swift%20Fox"],
    ["a non-numeric time", "?t=fast&by=Swift%20Fox"],
    ["a zero time", "?t=0&by=Swift%20Fox"],
    ["a negative time", "?t=-30&by=Swift%20Fox"],
  ])("ignores %s", (_label, search) => {
    expect(parseChallenge(search)).toBeNull();
  });

  it("clamps an absurdly long time to just under a day", () => {
    expect(parseChallenge("?t=99999999&by=Slow%20Sloth")?.seconds).toBe(
      MAX_CHALLENGE_SECONDS,
    );
  });

  it("tidies the name: trims, collapses whitespace, drops control characters", () => {
    expect(parseChallenge("?t=60&by=%20%20Swift%0A%0A%20Fox%09")?.name).toBe(
      "Swift Fox",
    );
  });

  it("caps a long name", () => {
    const name = parseChallenge(`?t=60&by=${"A".repeat(200)}`)?.name ?? "";
    expect(name).toHaveLength(MAX_CHALLENGER_NAME_LENGTH);
  });

  it("falls back to a friendly name when none is given", () => {
    expect(parseChallenge("?t=60")?.name).toBe("A friend");
    expect(parseChallenge("?t=60&by=%20%20")?.name).toBe("A friend");
  });
});
