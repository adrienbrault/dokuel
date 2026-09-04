import { expect } from "@playwright/test";
import { readBoard, test } from "./fixtures.ts";

test("solo resumes and starts a new puzzle without a network connection", async ({
  page,
  context,
}) => {
  await page.goto("/solo/easy/offline-resume");
  await page
    .getByRole("button", { name: /, empty/ })
    .first()
    .click();
  await page
    .getByRole("group", { name: "Number pad" })
    .getByRole("button", { name: "5", exact: true })
    .click();
  const board = await readBoard(page);
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.active),
      ),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  expect(await readBoard(page)).toBe(board);
  await page.goto("/solo/easy/offline-new");
  expect((await readBoard(page)).length).toBe(81);
  await expect(
    page.getByRole("button", { name: "Hint", exact: true }),
  ).toBeEnabled();
});
