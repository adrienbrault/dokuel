import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures.ts";

/**
 * Offline play: after one online visit the service worker has the
 * app shell cached, so solo and daily keep working with no network.
 *
 * Service workers are blocked for every other spec (see
 * playwright.config.ts); this one needs the real thing. Viewport
 * independent, so Desktop only.
 */
test.use({ serviceWorkers: "allow" });

test.beforeEach(async ({ page: _page }, testInfo) => {
  testInfo.skip(
    testInfo.project.name !== "Desktop",
    "viewport-independent — runs on Desktop only",
  );
});

async function visitOnceOnline(page: Page) {
  await page.goto("/");
  // Resolves once the worker is active, i.e. its precache is complete.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

test("a solo game starts after reloading with no network", async ({
  page,
  context,
}) => {
  await visitOnceOnline(page);

  await context.setOffline(true);
  await page.reload();

  // Multiplayer needs the signaling server, and says so.
  await expect(
    page.getByRole("button", { name: /Create Game/ }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /Join Game/ })).toBeDisabled();

  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await expect(
    page.locator('[role="group"][aria-label="Number pad"]:visible'),
  ).toBeVisible();
  await expect(page.locator('button[aria-label^="Cell row"]')).toHaveCount(81);
});

test("a deep link to the daily challenge opens offline", async ({
  page,
  context,
}) => {
  await visitOnceOnline(page);

  await context.setOffline(true);
  // Never visited before: served by the cached shell, routed client side.
  await page.goto("/daily");

  await expect(page.locator('button[aria-label^="Cell row"]')).toHaveCount(81);
});
