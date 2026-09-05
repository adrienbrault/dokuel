import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { FriendChallenge } from "../lib/challenge.ts";
import type { FriendReceipt } from "../lib/friend-receipt.ts";
import { ResultShare } from "./ResultShare.tsx";

const challenge: FriendChallenge = {
  version: 1,
  puzzle:
    ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
  difficulty: "easy",
  assistLevel: "paper",
  hintsUsed: 0,
  timeSeconds: 222,
};

const receipt: FriendReceipt = {
  version: 1,
  matchId: "match-1",
  challenge,
  challenger: {
    name: "Adrien",
    timeSeconds: 222,
    assistLevel: "paper",
    hintsUsed: 0,
  },
  friend: {
    name: "Luna",
    timeSeconds: 180,
    assistLevel: "paper",
    hintsUsed: 0,
  },
};

afterEach(() => vi.unstubAllGlobals());

it("provides selectable challenge text when native sharing and clipboard both fail", async () => {
  const share = vi.fn().mockRejectedValue(new Error("Unavailable"));
  const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
  vi.stubGlobal("navigator", { share, clipboard: { writeText } });
  render(<ResultShare time="03:42" shareChallenge={challenge} />);
  fireEvent.click(screen.getByRole("button", { name: "Challenge a friend" }));
  const fallback = await screen.findByRole("textbox", { name: "Share text" });
  expect(share).toHaveBeenCalledOnce();
  expect(writeText).toHaveBeenCalledOnce();
  expect((fallback as HTMLTextAreaElement).value).toContain("/challenge/");
  expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
});

it("leaves cancellation alone when the user dismisses native sharing", async () => {
  const share = vi
    .fn()
    .mockRejectedValue(new DOMException("Cancelled", "AbortError"));
  const writeText = vi.fn();
  vi.stubGlobal("navigator", { share, clipboard: { writeText } });
  render(<ResultShare time="03:42" shareChallenge={challenge} />);
  fireEvent.click(screen.getByRole("button", { name: "Challenge a friend" }));
  await waitFor(() => expect(share).toHaveBeenCalledOnce());
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("shares a comparison receipt back to the challenge sender", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<ResultShare time="03:00" shareReceipt={receipt} />);

  fireEvent.click(
    screen.getByRole("button", { name: "Send result to friend" }),
  );
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  expect(writeText.mock.calls[0]?.[0]).toContain("/receipt/");
  expect(writeText.mock.calls[0]?.[0]).toContain("Adrien");
  expect(writeText.mock.calls[0]?.[0]).toContain("Luna");
});
