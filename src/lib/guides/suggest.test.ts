import { describe, expect, it } from "vitest";
import { suggestGuide } from "./suggest.ts";
import type { Guide } from "./types.ts";

function stub(id: Guide["id"], level: Guide["level"]): Guide {
  return {
    id,
    title: id,
    level,
    summary: "",
    sections: [],
    demos: [],
  };
}

describe("suggestGuide", () => {
  it("returns a tier-matched unviewed guide for the played difficulty", () => {
    const guides = [stub("scanning", "beginner"), stub("x-wing", "advanced")];
    const result = suggestGuide(guides, {
      difficulty: "easy",
      viewed: new Set(),
    });
    expect(result?.id).toBe("scanning");
  });

  it("skips guides already viewed in the same tier", () => {
    const guides = [
      stub("scanning", "beginner"),
      stub("naked-singles", "beginner"),
    ];
    const result = suggestGuide(guides, {
      difficulty: "easy",
      viewed: new Set(["scanning"]),
    });
    expect(result?.id).toBe("naked-singles");
  });

  it("returns null only when every guide has been viewed", () => {
    const guides = [stub("scanning", "beginner"), stub("x-wing", "advanced")];
    const result = suggestGuide(guides, {
      difficulty: "easy",
      viewed: new Set(["scanning", "x-wing"]),
    });
    expect(result).toBeNull();
  });

  it("falls back to an unviewed guide outside the tier when the tier is exhausted", () => {
    const guides = [stub("scanning", "beginner"), stub("x-wing", "advanced")];
    const result = suggestGuide(guides, {
      difficulty: "expert",
      viewed: new Set(["x-wing"]),
    });
    expect(result?.id).toBe("scanning");
  });

  it("with hintsUsed > 2, biases toward foundational singles regardless of tier", () => {
    const guides = [
      stub("scanning", "beginner"),
      stub("naked-singles", "beginner"),
      stub("hidden-singles", "beginner"),
      stub("x-wing", "advanced"),
    ];
    const result = suggestGuide(guides, {
      difficulty: "expert",
      hintsUsed: 3,
      viewed: new Set(),
    });
    expect(
      result?.id === "naked-singles" || result?.id === "hidden-singles",
    ).toBe(true);
  });
});
