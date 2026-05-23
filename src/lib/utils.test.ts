import { describe, expect, it } from "vitest";
import { cn } from "./utils.ts";

describe("cn", () => {
  it("merges conditional classes and dedupes conflicting Tailwind utilities", () => {
    const disabled = false as boolean;
    expect(cn("px-2 py-1", disabled && "hidden", "px-4")).toBe("py-1 px-4");
  });
});
