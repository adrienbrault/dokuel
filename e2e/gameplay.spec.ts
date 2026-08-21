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

test("tapping a digit notes a drag-selected range, then hands off to highlights", async ({
  page,
}) => {
  // Pins the range-noting rhythm end to end with the misfire geometry
  // (off-center clicks with mouse wobble, which center-relative slop
  // used to misread as drags): tap notes the range and releases it,
  // the next tap is the grid-highlight gesture and must not scribble
  // more notes, and hold is the stacking gesture that keeps the
  // selection.
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

  // The legend tracks the tap action: with a range selected, tap
  // pencils notes and the cheat-sheet must say so.
  await expect(
    page.getByText("tap = note · hold = note · drag = place"),
  ).toBeVisible();

  // Off-center click with 2px of wobble — the geometry that used to
  // misfire a drag under center-relative slop.
  const pad = page.locator('[role="group"][aria-label="Number pad"]:visible');
  const wobblyClick = async (name: RegExp) => {
    const btn = pad.getByRole("button", { name });
    const box = await btn.boundingBox();
    if (!box) throw new Error("digit not visible");
    await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2 + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2 + 6);
    await page.mouse.up();
  };

  // Tap 1: the note lands in both cells and the selection is released
  // (legend back to enter-mode).
  await wobblyClick(/^1(,|$)/);
  for (const idx of [start, start + 1]) {
    await expect(cellAt(idx)).toHaveAttribute("aria-label", /notes 1$/);
  }
  await expect(
    page.getByText("tap = enter · hold = note · drag = place"),
  ).toBeVisible();

  // Tap 2: with the selection released this is the grid-highlight
  // gesture — it must NOT pencil more notes into the old range.
  await wobblyClick(/^2(,|$)/);
  for (const idx of [start, start + 1]) {
    await expect(cellAt(idx)).toHaveAttribute("aria-label", /notes 1$/);
  }

  // Stacking a pair uses hold, the gesture that keeps the selection:
  // re-select the range and hold 2 → both cells carry {1,2}.
  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  await holdNumpadDigit(page, pad.getByRole("button", { name: /^2(,|$)/ }));
  for (const idx of [start, start + 1]) {
    await expect(cellAt(idx)).toHaveAttribute("aria-label", /notes 1 2$/);
  }
});

test("dragging a digit off the numpad lands a value or a note by drop zone", async ({
  page,
}) => {
  // The drag is one continuous gesture that crosses the whole input
  // stack — numpad press, promotion off the pad, cell hit-test, drop —
  // and which HALF of the cell the finger releases over is the only
  // thing that decides between a value and a note. Both zones, in one
  // real browser, against the real board.
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  const pad = page.locator('[role="group"][aria-label="Number pad"]:visible');
  const board = await readBoard(page);
  const empties = [...board].flatMap((c, i) => (c === "." ? [i] : []));
  const [valueCell, noteCell] = empties;
  if (valueCell === undefined || noteCell === undefined) {
    throw new Error("board has fewer than 2 empty cells");
  }
  const cellAt = (idx: number) =>
    page.locator(
      `button[aria-label^="Cell row ${Math.floor(idx / 9) + 1} column ${(idx % 9) + 1},"]`,
    );

  // `zone` is the fraction down the cell to release at: the drop zone is
  // split at the midline, so 0.25 is squarely a value and 0.75 a note.
  const dragDigitTo = async (digit: string, idx: number, zone: number) => {
    const key = pad.getByRole("button", { name: new RegExp(`^${digit}(,|$)`) });
    const keyBox = await key.boundingBox();
    const cellBox = await cellAt(idx).boundingBox();
    if (!keyBox || !cellBox) throw new Error("digit or cell not visible");
    await page.mouse.move(
      keyBox.x + keyBox.width / 2,
      keyBox.y + keyBox.height / 2,
    );
    await page.mouse.down();
    // Straight up — perpendicular to the bottom numpad — so the press
    // classifies as a drag rather than an along-axis skim.
    await page.mouse.move(
      keyBox.x + keyBox.width / 2,
      keyBox.y + keyBox.height / 2 - 24,
      { steps: 3 },
    );
    await page.mouse.move(
      cellBox.x + cellBox.width / 2,
      cellBox.y + cellBox.height * zone,
      { steps: 8 },
    );
    await page.mouse.up();
  };

  // A digit whose every placement is already on the board is disabled
  // and invisible, so each drag has to start from a live key.
  const liveDigit = async () => {
    const d = await pad
      .locator("button:not([disabled])")
      .first()
      .evaluate((el) => el.getAttribute("data-numpad-digit") ?? "");
    if (!d) throw new Error("no enabled numpad digit");
    return d;
  };

  // Top half → the digit is entered as the cell's value. The board is
  // random, so allow the label's trailing ", conflict".
  const valueDigit = await liveDigit();
  await dragDigitTo(valueDigit, valueCell, 0.25);
  await expect(cellAt(valueCell)).toHaveAttribute(
    "aria-label",
    new RegExp(`, value ${valueDigit}(,|$)`),
  );

  // Bottom half → the same gesture pencils a note and leaves the cell empty.
  const noteDigit = await liveDigit();
  await dragDigitTo(noteDigit, noteCell, 0.75);
  await expect(cellAt(noteCell)).toHaveAttribute(
    "aria-label",
    new RegExp(`, empty,.*notes ${noteDigit}$`),
  );
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
