import { expect } from "@playwright/test";
import {
  holdNumpadDigit,
  nearlyWonSave,
  priorEasyStats,
  readBoard,
  test,
} from "./fixtures.ts";

/**
 * Functional end-to-end flows: completion, persistence, determinism,
 * and note input, asserted against the real UI. (The two-tab
 * multiplayer flow lives in screenshots.spec.ts, where its progress
 * sync and win propagation are asserted while the scenes are
 * captured.)
 *
 * These flows are viewport-independent, so they run once on Desktop
 * instead of ×4 devices — the screenshot suite covers per-device
 * rendering.
 */
test.beforeEach(async ({ page: _page }, testInfo) => {
  testInfo.skip(
    testInfo.project.name !== "Desktop",
    "viewport-independent — runs on Desktop only",
  );
});

test.describe("game completion", () => {
  test.use({
    storage: {
      "sudoku_save_e2e-done": nearlyWonSave,
      sudoku_stats: priorEasyStats,
    },
  });

  test("completing a puzzle shows the result dialog and records the win", async ({
    page,
  }) => {
    await page.goto("/solo/easy/e2e-done");
    await page.locator('button[aria-label*=", empty"]').click();
    await page.keyboard.press("5");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("You Won!")).toBeVisible();
    await expect(dialog.getByText("New Personal Best!")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Share Result" }),
    ).toBeVisible();

    // The win landed in stats and the autosave was consumed.
    const { statsCount, saveGone } = await page.evaluate(() => ({
      statsCount: JSON.parse(localStorage.getItem("sudoku_stats") ?? "[]")
        .length,
      saveGone: localStorage.getItem("sudoku_save_e2e-done") === null,
    }));
    expect(statsCount).toBe(3);
    expect(saveGone).toBe(true);
  });
});

test("an in-progress solo game survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  const cell = page.locator('button[aria-label*=", empty"]').first();
  const label = await cell.getAttribute("aria-label");
  const prefix = label?.split(",")[0];
  if (!prefix) throw new Error("empty cell has no accessible name");
  await cell.click();
  await page.keyboard.press("7");
  await expect(
    page.locator(`button[aria-label^="${prefix}, value 7"]`),
  ).toBeVisible();

  // The URL carries the game key, so a reload must restore the board.
  await page.reload();
  await expect(
    page.locator(`button[aria-label^="${prefix}, value 7"]`),
  ).toBeVisible();
});

test("the daily challenge regenerates the same board after storage is cleared", async ({
  page,
}) => {
  await page.goto("/daily");
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
  const firstBoard = await readBoard(page);

  // Clearing storage removes the autosave, so an identical board on
  // reload proves date-seeded generation — not save restoration.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
  expect(await readBoard(page)).toBe(firstBoard);
});

test("clicking digits notes a drag-selected range and keeps the selection", async ({
  page,
}) => {
  // The desktop bug this pins: gesture slop was measured from the
  // numpad button's center, so an off-center click with a few pixels
  // of mouse wobble misfired a drag/skim instead of tapping — and the
  // tap itself used to discard a multi-cell selection. Both clicks
  // here land off-center with wobble; the second landing proves the
  // selection survived the first.
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  // Two adjacent empty cells in one row, drag-selected with the mouse.
  const board = await readBoard(page);
  let start = -1;
  for (let i = 0; i < 80; i++) {
    if (board[i] === "." && board[i + 1] === "." && i % 9 < 8) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error("no adjacent empty pair on easy board");
  const cellAt = (idx: number) =>
    page.locator(
      `button[aria-label^="Cell row ${Math.floor(idx / 9) + 1} column ${(idx % 9) + 1},"]`,
    );
  const boxA = await cellAt(start).boundingBox();
  const boxB = await cellAt(start + 1).boundingBox();
  if (!boxA || !boxB) throw new Error("cells not visible");
  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, {
    steps: 6,
  });
  await page.mouse.up();

  // Click two numpad digits, each off-center with 2px of wobble.
  const pad = page.locator('[role="group"][aria-label="Number pad"]:visible');
  const digits: number[] = [];
  for (const name of [/^1(,|$)/, /^2(,|$)/]) {
    const btn = pad.getByRole("button", { name });
    const box = await btn.boundingBox();
    if (!box) throw new Error("digit not visible");
    digits.push(Number((await btn.textContent())?.trim()[0]));
    await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2 + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2 + 6);
    await page.mouse.up();
  }

  // Both cells carry both digits as notes — the range got the first
  // note AND stayed selected for the second.
  const notes = `notes ${digits.sort((a, b) => a - b).join(" ")}`;
  for (const idx of [start, start + 1]) {
    await expect(cellAt(idx)).toHaveAttribute(
      "aria-label",
      new RegExp(`${notes}$`),
    );
  }
});

test("holding a numpad digit writes a pencil note", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  const cell = page.locator('button[aria-label*=", empty"]').first();
  const label = await cell.getAttribute("aria-label");
  const prefix = label?.split(",")[0];
  if (!prefix) throw new Error("empty cell has no accessible name");
  await cell.click();

  const digit = page
    .locator(
      '[role="group"][aria-label="Number pad"]:visible button:not([disabled])',
    )
    .first();
  await holdNumpadDigit(page, digit);

  await expect(
    page.locator(`button[aria-label^="${prefix},"][aria-label*="notes"]`),
  ).toBeVisible();
});
