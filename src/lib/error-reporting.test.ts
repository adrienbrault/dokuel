import { describe, expect, it } from "vitest";
import { routeTemplate } from "./error-reporting.ts";

describe("routeTemplate", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/daily", "/daily"],
    ["/join/", "/join"],
    ["/stats", "/stats"],
    ["/solo/hard/k3j9x2", "/solo/hard/:game"],
    ["/bold-bear", "/:room"],
    ["/bold-bear-a1b2", "/:room"],
    ["/some/unknown/path", "/:other"],
  ])("reduces %s to %s", (pathname, expected) => {
    expect(routeTemplate(pathname)).toBe(expected);
  });
});
