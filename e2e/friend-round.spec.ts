import { expect } from "@playwright/test";
import { parseChallenge } from "../src/lib/challenge.ts";
import {
  type FriendReceipt,
  friendReceiptPath,
  parseFriendReceipt,
} from "../src/lib/friend-receipt.ts";
import { solvePuzzle } from "../src/lib/sudoku.ts";
import { fillCells, readBoard, test } from "./fixtures.ts";

const receipt: FriendReceipt = {
  version: 1,
  matchId: "browser-first-round",
  challenge: {
    version: 1,
    puzzle:
      ".34678912672195348198342567859761423426853791713924856961537284287419635345286179",
    difficulty: "easy",
    assistLevel: "standard",
    timeSeconds: 100,
    hintsUsed: 0,
  },
  challenger: {
    name: "Alex",
    timeSeconds: 100,
    assistLevel: "standard",
    hintsUsed: 0,
  },
  friend: {
    name: "Sam",
    timeSeconds: 120,
    assistLevel: "standard",
    hintsUsed: 0,
  },
};

test("a friend sets a new target before sharing the next series round", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { sharedText: string }).sharedText = text;
        },
      },
      configurable: true,
    });
  });
  await page.goto(friendReceiptPath(receipt));
  await expect(
    page.getByRole("button", { name: "Start best of 3" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "I am Sam" }).check();
  await page.getByRole("button", { name: "Start best of 3" }).click();
  const fresh = await readBoard(page);
  expect(fresh).not.toBe(receipt.challenge.puzzle);
  await page.reload();
  expect(await readBoard(page)).toBe(fresh);
  const solution = solvePuzzle(fresh);
  if (!solution) throw new Error("Next round is unsolvable");
  const empty = [...fresh].flatMap((value, index) =>
    value === "." ? [index] : [],
  );
  await fillCells(page, solution, empty);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Challenge a friend" })
    .click();
  const shared = await page.evaluate(
    () => (window as unknown as { sharedText: string }).sharedText,
  );
  const url = shared.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error("No next-round challenge link");
  const challenge = parseChallenge(
    new URL(url).pathname.slice("/challenge/".length),
  );
  expect(challenge?.puzzle).toBe(fresh);
  expect(challenge?.timeSeconds).not.toBe(receipt.friend.timeSeconds);
  expect(challenge?.setter).toBe("friend");
  expect(challenge?.series?.gameNumber).toBe(2);
  await page.goto(url);
  await page.getByRole("button", { name: "Start challenge" }).click();
  expect(await readBoard(page)).toBe(fresh);
  await fillCells(page, solution, empty);
  await page.getByRole("button", { name: "Send result to friend" }).click();
  const returnText = await page.evaluate(
    () => (window as unknown as { sharedText: string }).sharedText,
  );
  const returnUrl = returnText.match(/https?:\/\/\S+/)?.[0];
  if (!returnUrl) throw new Error("No comparison receipt link");
  const next = parseFriendReceipt(
    new URL(returnUrl).pathname.slice("/receipt/".length),
  );
  expect(next?.friend.name).toBe("Sam");
  expect(next?.challenger.name).toBe("Alex");
  expect(next?.friend.timeSeconds).toBe(challenge?.timeSeconds);
  expect(next?.series?.gameNumber).toBe(2);
  await page.goto(returnUrl);
  await expect(
    page.getByRole("heading", { name: "Race result" }),
  ).toBeVisible();
  await page.screenshot({
    path: `e2e/screenshots/friend-comparison--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
});
