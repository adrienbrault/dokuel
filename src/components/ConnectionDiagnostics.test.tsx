import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { beginConnectionDiagnostics } from "../lib/connection-diagnostics.ts";
import { ConnectionDiagnostics } from "./ConnectionDiagnostics.tsx";

it("explains relay fallback without exposing the room code", () => {
  const record = beginConnectionDiagnostics("secret-room");
  record("stun-only");
  render(<ConnectionDiagnostics roomId="secret-room" />);
  expect(screen.getByText(/Relay unavailable/)).toBeInTheDocument();
  expect(screen.queryByText("secret-room")).not.toBeInTheDocument();
});
