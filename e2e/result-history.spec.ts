import { expect } from "@playwright/test";
import { test } from "./fixtures.ts";

test.use({
  storage: {
    sudoku_stats: JSON.stringify([
      {
        difficulty: "easy",
        assistLevel: "standard",
        time: 300,
        won: true,
        date: "2026-09-04",
        origin: "generated",
      },
      {
        difficulty: "easy",
        assistLevel: "standard",
        time: 60,
        won: true,
        date: "2026-09-04",
        origin: "friend",
      },
    ]),
  },
});

test("stats separates puzzle sources", async ({ page }, testInfo) => {
  await page.goto("/stats");
  const solo = page.getByRole("region", { name: "Solo" });
  await expect(solo.getByText("05:00").first()).toBeVisible();
  await page.getByLabel("Puzzle source").selectOption("friend");
  await expect(solo.getByText("01:00").first()).toBeVisible();
  await expect(solo.getByText("05:00")).toHaveCount(0);
  await page.screenshot({
    path: `e2e/screenshots/result-sources--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
});
