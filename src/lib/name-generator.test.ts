import { describe, expect, it } from "vitest";
import { generatePlayerName } from "./name-generator.ts";

describe("generatePlayerName", () => {
  it("returns a string with two words (adjective + noun)", () => {
    const name = generatePlayerName();
    const words = name.split(" ");
    expect(words).toHaveLength(2);
    expect(words[0]!.length).toBeGreaterThan(0);
    expect(words[1]!.length).toBeGreaterThan(0);
  });

  it("capitalizes both words", () => {
    const name = generatePlayerName();
    const [first, second] = name.split(" ");
    expect(first![0]).toBe(first![0]!.toUpperCase());
    expect(second![0]).toBe(second![0]!.toUpperCase());
  });

  it("generates different names on repeated calls", () => {
    const names = new Set(Array.from({ length: 20 }, () => generatePlayerName()));
    expect(names.size).toBeGreaterThan(1);
  });
});
