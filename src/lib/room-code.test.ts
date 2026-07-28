// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateRoomCode } from "./room-code.ts";

describe("generateRoomCode", () => {
  it("produces word-word-suffix codes with an unambiguous suffix alphabet", () => {
    // Suffix excludes 0/1/i/l/o so codes survive being read aloud or
    // hand-copied from a screenshot.
    for (let i = 0; i < 20; i++) {
      expect(generateRoomCode()).toMatch(/^[a-z]{3,4}-[a-z]{4}-[a-z2-9]{4}$/);
    }
  });

  it("does not repeat across many draws", () => {
    // The old 25×25×90 space (56k codes) was enumerable — any active
    // room could be found and joined by a stranger — and collided at
    // birthday-paradox rates once a few hundred rooms existed. The
    // 4-char suffix multiplies the space to ~5×10^8.
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      codes.add(generateRoomCode());
    }
    expect(codes.size).toBe(200);
  });
});
