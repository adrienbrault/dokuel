import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createErrorReporter,
  installGlobalErrorReporting,
  routeTemplate,
} from "./error-reporting.ts";
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

  it("reports a repeating error once and caps distinct ones per page", () => {
    const reporter = createErrorReporter({
      getPathname: () => "/",
      maxReports: 3,
    });

    for (let i = 0; i < 50; i++) reporter.report(new Error("loop"), "window");
    reporter.report("loop", "rejection");
    for (let i = 0; i < 10; i++) reporter.report(`distinct ${i}`, "window");

    expect(
      telemetry
        .events()
        .map((event) =>
          event.name === "error" ? `${event.source}:${event.message}` : "",
        ),
    ).toEqual(["window:loop", "rejection:loop", "window:distinct 0"]);
  });
});

describe("installGlobalErrorReporting", () => {
  it("reports uncaught errors and unhandled rejections until removed", () => {
    const telemetry = recordTelemetry();
    const uninstall = installGlobalErrorReporting(
      window,
      createErrorReporter({ getPathname: () => "/daily" }),
    );

    window.dispatchEvent(
      new ErrorEvent("error", { error: new TypeError("uncaught") }),
    );
    // Cross-origin script errors arrive with no error object at all.
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: "rejected" }),
    );
    uninstall();
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("after uninstall") }),
    );

    expect(
      telemetry
        .events()
        .map((event) =>
          event.name === "error" ? `${event.source}:${event.message}` : "",
        ),
    ).toEqual([
      "window:uncaught",
      "window:Script error.",
      "rejection:rejected",
    ]);
    telemetry.stop();
  });
});
