import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { FriendReceipt } from "../lib/friend-receipt.ts";
import { recordRivalry } from "../lib/rivalry.ts";
import { RivalryHistory } from "./RivalryHistory.tsx";

it("lets a player reopen a saved named comparison", () => {
  localStorage.clear();
  const receipt: FriendReceipt = { version: 1, matchId: "history-match", challenge: { version: 1, puzzle: ".34678912672195348198342567859761423426853791713924856961537284287419635345286179", difficulty: "easy", assistLevel: "standard", timeSeconds: 100, hintsUsed: 0 }, challenger: { name: "Alex", timeSeconds: 100, assistLevel: "standard", hintsUsed: 0 }, friend: { name: "Sam", timeSeconds: 120, assistLevel: "standard", hintsUsed: 0 } };
  expect(recordRivalry(receipt)).toBe(true);
  render(<RivalryHistory />);
  expect(screen.getByRole("link", { name: /Alex.*Sam/ })).toHaveAttribute("href", expect.stringContaining("/receipt/"));
  expect(screen.getByText(/Alex finished first/)).toBeInTheDocument();
});
