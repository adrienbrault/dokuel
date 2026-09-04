import { expect } from "@playwright/test";
import { test } from "./fixtures.ts";

test("backup download restores a saved board only after preview confirmation", async ({
  page,
}, testInfo) => {
  await page.goto("/solo/easy/backup-browser");
  await expect(page.getByRole("grid").getByRole("button")).toHaveCount(81);
  await page.goto("/stats");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Backup download missing");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Import progress").setInputFiles(path);
  await expect(
    page.getByRole("region", { name: "Progress backup" }),
  ).toContainText("1 saved game");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("sudoku_save_backup-browser"),
    ),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Replace local progress" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `e2e/screenshots/backup-preview--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Replace local progress" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Progress restored from the backup.",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("sudoku_save_backup-browser"),
    ),
  ).not.toBeNull();
});

test("privacy preferences stay optional and show their exact scope", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByText("Privacy & help shape Dokuel", { exact: true }).click();
  const consent = page.getByRole("switch", { name: "Share anonymous usage" });
  await expect(consent).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Short duels" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Enable anonymous usage",
  );
  await consent.click();
  await expect(consent).toHaveAttribute("aria-checked", "true");
  await consent.click();
  await expect(consent).toHaveAttribute("aria-checked", "false");
  await page.screenshot({
    path: `e2e/screenshots/privacy-choice--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
});

test("progressive hints lead to an accessible exercise on a new board", async ({
  page,
}, testInfo) => {
  const solution =
    "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
  const puzzle = `.${solution.slice(1)}`;
  await page.goto("/");
  await page.evaluate(
    (board) =>
      localStorage.setItem(
        "sudoku_save_practice-e2e",
        JSON.stringify({
          puzzle: board,
          values: board,
          notes: Array.from({ length: 81 }, () => []),
          timer: 0,
          difficulty: "easy",
          assistLevel: "standard",
          hintsUsed: 0,
        }),
      ),
    puzzle,
  );
  await page.goto("/solo/easy/practice-e2e");
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  for (const step of ["pattern", "elimination", "reveal"]) {
    await page.getByRole("button", { name: `Show ${step} hint step` }).click();
  }
  await page.getByRole("button", { name: "Practice naked single" }).click();
  const board = page.getByRole("grid", { name: "Practice board" });
  await expect(board.getByRole("row")).toHaveCount(9);
  await expect(board.getByRole("gridcell")).toHaveCount(81);
  await expect(
    page.getByRole("region", { name: "Technique practice" }),
  ).toContainText("new board");
  await board.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `e2e/screenshots/technique-practice--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
});
