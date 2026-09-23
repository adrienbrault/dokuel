// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildChallengeShare,
  buildChallengeText,
  buildChallengeUrl,
  compareToChallenge,
  MAX_CHALLENGE_SECONDS,
  MAX_CHALLENGER_NAME_LENGTH,
  normalizeChallenge,
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

  it("remembers that the challenger's time was hint-assisted", () => {
    expect(parseChallenge("?t=60&by=Fox&h=1")?.hinted).toBe(true);
    expect(parseChallenge("?t=60&by=Fox&h=0")?.hinted).toBe(false);
  });

  it("falls back to a friendly name when none is given", () => {
    expect(parseChallenge("?t=60")?.name).toBe("A friend");
    expect(parseChallenge("?t=60&by=%20%20")?.name).toBe("A friend");
  });
});

describe("normalizeChallenge", () => {
  it("rebuilds a stored challenge whose fields were mangled", () => {
    expect(
      normalizeChallenge({ name: 42, seconds: 90.7, hinted: "yes" }),
    ).toEqual({ name: "A friend", seconds: 90, hinted: false });
  });

  it("rejects anything that is not an object with a time", () => {
    expect(normalizeChallenge(null)).toBeNull();
    expect(normalizeChallenge("272")).toBeNull();
    expect(normalizeChallenge({ name: "Fox" })).toBeNull();
  });
});

describe("compareToChallenge", () => {
  const fox = { name: "Swift Fox", seconds: 272, hinted: false };

  it("says by how much the player beat the challenger", () => {
    expect(
      compareToChallenge({ seconds: 231, hintsUsed: 0, challenge: fox }),
    ).toMatchObject({ outcome: "won", headline: "You beat Swift Fox by 0:41" });
  });

  it("says how much faster the challenger was", () => {
    expect(
      compareToChallenge({ seconds: 284, hintsUsed: 0, challenge: fox }),
    ).toMatchObject({ outcome: "lost", headline: "Swift Fox was 0:12 faster" });
  });

  it("calls an identical time a tie", () => {
    expect(
      compareToChallenge({ seconds: 272, hintsUsed: 0, challenge: fox }),
    ).toMatchObject({ outcome: "tie", headline: "Dead heat with Swift Fox" });
  });

  it("notes honestly when hints helped either side", () => {
    const hintedFox = { ...fox, hinted: true };
    const note = (hintsUsed: number, challenge = fox) =>
      compareToChallenge({ seconds: 200, hintsUsed, challenge }).hintNote;
    expect(note(0)).toBeNull();
    expect(note(2)).toBe("You used hints");
    expect(note(0, hintedFox)).toBe("Swift Fox used hints");
    expect(note(1, hintedFox)).toBe("Both of you used hints");
  });
});

describe("buildChallengeText", () => {
  it("invites the friend to beat the time on this board", () => {
    expect(
      buildChallengeText({ seconds: 272, hinted: false, difficulty: "easy" }),
    ).toBe("Can you beat my 4:32 on this Easy Dokuel sudoku?");
  });

  it("owns up to hints in the invite", () => {
    expect(
      buildChallengeText({ seconds: 272, hinted: true, difficulty: "expert" }),
    ).toBe("Can you beat my 4:32 (with hints) on this Expert Dokuel sudoku?");
  });
});

describe("buildChallengeShare", () => {
  it("pairs the invite line with the link for one finished board", () => {
    expect(
      buildChallengeShare({
        origin: "https://dokuel.com",
        name: "Brave Otter",
        difficulty: "easy",
        gameKey: "k3y",
        seconds: 231,
        hinted: false,
      }),
    ).toEqual({
      text: "Can you beat my 3:51 on this Easy Dokuel sudoku?",
      url: "https://dokuel.com/solo/easy/k3y?t=231&by=Brave+Otter",
    });
  });

  it("never sends a zero time the receiver would throw away", () => {
    const { url } = buildChallengeShare({
      origin: "https://dokuel.com",
      name: "Brave Otter",
      difficulty: "easy",
      gameKey: "k3y",
      seconds: 0,
      hinted: false,
    });
    expect(parseChallenge(new URL(url).search)?.seconds).toBe(1);
  });
});

describe("buildChallengeUrl", () => {
  it("points at the same solo board and round-trips through parseChallenge", () => {
    const challenge = { name: "Swift Fox", seconds: 272, hinted: true };
    const url = new URL(
      buildChallengeUrl({
        origin: "https://dokuel.com",
        difficulty: "hard",
        gameKey: "k3y",
        challenge,
      }),
    );
    expect(url.origin).toBe("https://dokuel.com");
    expect(url.pathname).toBe("/solo/hard/k3y");
    expect(parseChallenge(url.search)).toEqual(challenge);
  });
});
