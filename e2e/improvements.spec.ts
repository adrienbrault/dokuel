import { expect } from "@playwright/test";
import { nearlyWonSave, preparePage, readBoard, test } from "./fixtures.ts";

test("expanded settings stay within the viewport", async ({ page }) => {
  await page.goto("/solo/easy/accessible-settings");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Try the controls" }).click();
  const panel = page
    .getByText("Numpad position", { exact: true })
    .locator("../..");
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("button", { name: "How to play" })).toBeVisible();
});

// Real browser checks for the cross-screen promises made by the review fixes.
test.describe("friend challenge", () => {
  test.use({ storage: { "sudoku_save_share-source": nearlyWonSave } });
  test("shares, resumes and completes the exact puzzle in a fresh browser context", async ({
    page,
    browser,
  }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            sessionStorage.setItem("shared-text", text);
          },
        },
      });
    });
    await page.goto("/solo/easy/share-source");
    await page
      .getByRole("button", { name: /Cell row 1 column 1, empty/ })
      .click();
    await page
      .getByRole("group", { name: "Number pad" })
      .getByRole("button", { name: "5" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
    await dialog.getByRole("button", { name: "Challenge a friend" }).click();
    const shared = await page.evaluate(() =>
      sessionStorage.getItem("shared-text"),
    );
    const link = shared?.match(/https?:\/\/\S+/)?.[0];
    expect(link).toContain("/challenge/");

    const recipient = await browser.newContext({
      viewport: page.viewportSize()!,
    });
    try {
      const friend = await recipient.newPage();
      await preparePage(friend, {});
      await friend.goto(link!);
      await expect(
        friend.getByRole("heading", { name: /^Beat / }),
      ).toBeVisible();
      await expect(friend.getByText("Standard assistance")).toBeVisible();
      await friend.screenshot({
        path: `e2e/screenshots/friend-challenge-entry--${testInfo.project.name.replaceAll(" ", "-")}.png`,
      });
      await friend.getByRole("button", { name: "Start challenge" }).click();
      expect(await readBoard(friend)).toBe(JSON.parse(nearlyWonSave).puzzle);
      await friend
        .getByRole("button", { name: /Cell row 1 column 1, empty/ })
        .click();
      await friend.getByRole("button", { name: "Notes", exact: true }).click();
      await friend
        .getByRole("group", { name: "Number pad" })
        .getByRole("button", { name: /^5,/ })
        .click();
      friend.on("dialog", (prompt) => prompt.accept());
      await friend.getByRole("button", { name: "Back", exact: true }).click();
      await friend
        .getByRole("button", { name: /Continue challenge.*Easy/ })
        .click();
      await friend
        .getByRole("button", { name: "Continue challenge", exact: true })
        .click();
      await expect(
        friend.getByRole("button", {
          name: /Cell row 1 column 1, empty, notes 5/,
        }),
      ).toBeVisible();
      await friend.reload();
      await friend
        .getByRole("button", { name: "Continue challenge", exact: true })
        .click();
      await friend
        .getByRole("button", { name: /Cell row 1 column 1, empty/ })
        .click();
      await friend
        .getByRole("group", { name: "Number pad" })
        .getByRole("button", { name: "5", exact: true })
        .click();
      await expect(friend.getByRole("status")).toHaveText(
        /You beat the target by/,
      );
      await friend.screenshot({
        path: `e2e/screenshots/friend-challenge-result--${testInfo.project.name.replaceAll(" ", "-")}.png`,
      });
    } finally {
      await recipient.close();
    }
  });
});

test("the solo controls and number pad fit without scrolling", async ({
  page,
}) => {
  await page.goto("/solo/easy/controls-fit");
  const bounds = await page
    .getByRole("group", { name: "Number pad" })
    .boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
});

test("pause disables all input and leaves the saved board unchanged", async ({
  page,
}) => {
  await page.goto("/solo/easy/pause-check");
  const cell = page.getByRole("button", { name: /, empty/ }).first();
  await cell.click();
  const before = await readBoard(page);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  for (const name of ["Notes", "Undo", "Erase", "Hint"]) {
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  }
  await expect(
    page
      .getByRole("group", { name: "Number pad" })
      .getByRole("button", { name: "5", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("5");
  expect(await readBoard(page)).toBe(before);
  await page.getByRole("button", { name: "Resume game" }).click();
  await expect(
    page.getByRole("button", { name: "Hint", exact: true }),
  ).toBeEnabled();
});

test("Continue returns a legacy multiplayer save to its room", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    (save) =>
      localStorage.setItem("sudoku_save_mp_calm-lamb-g4bb_123.........", save),
    nearlyWonSave,
  );
  await page.reload();
  await page.getByRole("button", { name: /Return to duel/ }).click();
  await expect(page).toHaveURL(/\/calm-lamb-g4bb$/);
  await expect(page.getByText("Connecting...")).toBeVisible();
});
