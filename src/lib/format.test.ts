import { describe, expect, it } from "vitest";
import { formatShortDate, formatTime } from "./format.ts";

describe("formatTime", () => {
  it("formats zero seconds", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("pads single-digit minutes and seconds", () => {
    expect(formatTime(61)).toBe("01:01");
  });

  it("formats double-digit minutes and seconds", () => {
    expect(formatTime(599)).toBe("09:59");
  });

  it("handles times over an hour", () => {
    expect(formatTime(3600)).toBe("60:00");
  });

  it("handles exact minutes", () => {
    expect(formatTime(120)).toBe("02:00");
  });
});

describe("formatShortDate", () => {
  it("formats ISO date to short format", () => {
    expect(formatShortDate("2026-03-08")).toBe("Mar 8");
  });

  it("handles single-digit months", () => {
    expect(formatShortDate("2026-01-15")).toBe("Jan 15");
  });

  it("strips leading zeros from day", () => {
    expect(formatShortDate("2026-12-01")).toBe("Dec 1");
  });
});
