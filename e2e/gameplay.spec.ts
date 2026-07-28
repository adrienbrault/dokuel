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
