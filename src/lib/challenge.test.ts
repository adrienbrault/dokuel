// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseChallenge } from "./challenge.ts";

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
});
