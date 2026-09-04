import { expect, it } from "vitest";
import { beginConnectionDiagnostics, getConnectionDiagnostics } from "./connection-diagnostics.ts";

it("keeps a bounded local timeline and ignores an abandoned connection", () => {
  const stale = beginConnectionDiagnostics("room");
  const current = beginConnectionDiagnostics("room");
  stale("failed");
  expect(getConnectionDiagnostics("room").map((entry) => entry.stage)).toEqual(["opening"]);
  for (let i = 0; i < 40; i++) current(i % 2 ? "peer-reachable" : "peer-missing");
  expect(getConnectionDiagnostics("room")).toHaveLength(20);
  expect(getConnectionDiagnostics("room").at(-1)?.stage).toBe("peer-reachable");
});
