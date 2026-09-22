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
});
