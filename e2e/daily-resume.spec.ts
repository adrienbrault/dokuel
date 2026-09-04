import { expect } from "@playwright/test";
import { getDailyPuzzle } from "../src/lib/daily.ts";
import { readBoard, test } from "./fixtures.ts";

const date = "2025-01-02";
const { puzzle, solution } = getDailyPuzzle(date, "medium");
const empty = puzzle.indexOf(".");
const values =
  puzzle.slice(0, empty) + solution[empty] + puzzle.slice(empty + 1);
test.use({
  storage: {
    [`sudoku_save_daily-${date}-medium`]: JSON.stringify({
      puzzle,
      values,
      notes: Array.from({ length: 81 }, () => []),
      timer: 42,
      difficulty: "medium",
      assistLevel: "standard",
      hintsUsed: 0,
    }),
  },
});

test("past daily resumes its original board and date after refresh", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Continue daily/ })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `e2e/screenshots/past-daily--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /Continue daily/ }).click();
  await expect(page).toHaveURL(`/daily/${date}`);
  expect(await readBoard(page)).toBe(values);
  await page.reload();
  expect(await readBoard(page)).toBe(values);
  await expect(
    page.getByText("Daily Challenge — Jan 2", { exact: true }),
  ).toBeVisible();
});
