import { expect } from "@playwright/test";
import { test } from "./fixtures.ts";

test("keyboard focus follows the grid and Tab leaves in one step", async ({
  page,
}) => {
  await page.goto("/solo/easy/keyboard-focus");
  const cells = page
    .getByRole("grid", { name: "Sudoku puzzle" })
    .getByRole("button");
  await cells.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(cells.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(cells.nth(10)).toBeFocused();
  await page.keyboard.press("Control+End");
  await expect(cells.last()).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("grid")
      .evaluate((grid) => grid.contains(document.activeElement)),
  ).toBe(false);
  await page.keyboard.press("Shift+Tab");
  await expect(cells.last()).toBeFocused();
});

test("landscape with larger text keeps actions reachable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto("/solo/easy/large-text");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.screenshot({
    path: `e2e/screenshots/large-text-landscape--${testInfo.project.name.replaceAll(" ", "-")}.png`,
    fullPage: true,
  });
});
