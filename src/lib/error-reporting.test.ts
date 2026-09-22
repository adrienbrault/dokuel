import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createErrorReporter, routeTemplate } from "./error-reporting.ts";
import { recordTelemetry } from "./telemetry.fake.ts";

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

describe("createErrorReporter", () => {
  let telemetry: ReturnType<typeof recordTelemetry>;
  beforeEach(() => {
    telemetry = recordTelemetry();
  });
  afterEach(() => {
    telemetry.stop();
  });

  it("reports the message, a bounded stack and the route shape", () => {
    const reporter = createErrorReporter({ getPathname: () => "/bold-bear" });
    const error = new Error("x".repeat(400));
    error.stack = "s".repeat(3000);

    reporter.report(error, "boundary");

    expect(telemetry.events()).toEqual([
      {
        name: "error",
        source: "boundary",
        message: "x".repeat(300),
        stack: "s".repeat(2000),
        path: "/:room",
      },
    ]);
  });
});
