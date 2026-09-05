import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { solvePuzzle } from "../src/lib/sudoku.ts";
import {
  fillCells,
  holdNumpadDigit,
  nearlyWonSave,
  preparePage,
  priorEasyStats,
  readBoard,
  test,
} from "./fixtures.ts";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(name: string, project: string) {
  return join(SCREENSHOT_DIR, `${name}--${project.replace(/\s+/g, "-")}.png`);
}

test("landing page", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.screenshot({
    path: screenshotPath("landing", testInfo.project.name),
  });
});

test("solo game", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
  await page.screenshot({
    path: screenshotPath("solo-game", testInfo.project.name),
  });
});

test.describe("numpad positions", () => {
  test.use({ storage: { "sudoku-numpad-position": "left" } });
  test("solo game - numpad left", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start Solo" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );
    await page.screenshot({
      path: screenshotPath("solo-numpad-left", testInfo.project.name),
    });
  });
});

test.describe("numpad positions right", () => {
  test.use({ storage: { "sudoku-numpad-position": "right" } });
  test("solo game - numpad right", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start Solo" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );
    await page.screenshot({
      path: screenshotPath("solo-numpad-right", testInfo.project.name),
    });
  });
});

test("difficulty picker", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).waitFor();
  await page.screenshot({
    path: screenshotPath("difficulty", testInfo.project.name),
  });
});

test("multiplayer lobby", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.getByRole("heading", { name: "Game Lobby" }).waitFor();
  await page.screenshot({
    path: screenshotPath("multiplayer-lobby", testInfo.project.name),
  });
});

// --- Dark mode variants ---

test.describe("dark mode", () => {
  test.use({ storage: { sudoku_theme: "dark" } });

  test("landing page - dark mode", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.screenshot({
      path: screenshotPath("landing-dark", testInfo.project.name),
    });
  });

  test("solo game - dark mode", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start Solo" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );
    await page.screenshot({
      path: screenshotPath("solo-game-dark", testInfo.project.name),
    });
  });

  test("difficulty picker - dark mode", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start Solo" }).click();
    await page.getByRole("button", { name: "Easy" }).waitFor();
    await page.screenshot({
      path: screenshotPath("difficulty-dark", testInfo.project.name),
    });
  });

  test("solo game - cell selected with same number highlight (dark mode)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start Solo" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );

    // Click on a filled cell so that:
    // - That cell becomes selected (cell-selected bg)
    // - Same-number cells get highlighted (cell-same-number bg)
    // - Row/col/box cells get highlighted (cell-highlight bg)
    await page.locator('button[aria-label*="value"]').first().click();

    await page.screenshot({
      path: screenshotPath("solo-cell-selected-dark", testInfo.project.name),
    });
  });

  // multiplayer-progress-bars-dark is captured from the guest tab of
  // the real two-tab session below — see "multiplayer session".
});

// --- Missing screens ---

test("daily challenge", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Daily Challenge/ }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
  await page.screenshot({
    path: screenshotPath("daily-challenge", testInfo.project.name),
  });
});

test("join game screen", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Join Game" }).click();
  await page.getByRole("heading").waitFor();
  await page.screenshot({
    path: screenshotPath("join-game", testInfo.project.name),
  });
});

// --- Game states ---

test("solo game - numpad digit highlight", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  // With no cell selected, tapping a digit on the numpad toggles a
  // board-wide highlight of every cell holding that digit.
  await page
    .locator('[role="group"][aria-label="Number pad"]:visible')
    .getByRole("button", { name: /^5(,|$)/ })
    .first()
    .click();

  await page.screenshot({
    path: screenshotPath("solo-digit-highlight", testInfo.project.name),
  });
});

test("solo game - hold note charging in cell", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  // Select an empty cell so the hold has a meaningful target
  await page.locator('button[aria-label*=", empty"]').first().click();

  // Hold a digit past the threshold so the note commits and the in-cell
  // charge glyph appears, then screenshot. Animations are disabled here,
  // so the overlay snaps to its end state — what matters is that the
  // held note is visibly landing in the cell.
  const digit = page
    .locator(
      '[role="group"][aria-label="Number pad"]:visible button:not([disabled])',
    )
    .first();
  const box = await digit.boundingBox();
  if (!box) throw new Error("digit not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);

  await page.screenshot({
    path: screenshotPath("solo-hold-charging", testInfo.project.name),
  });

  await page.mouse.up();
});

test("solo game - drag from numpad mid-flight", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  // Find an empty cell roughly in the middle of the board to use as drop
  // target. The ghost will be rendered hovering over it.
  const emptyCell = page.locator('button[aria-label*=", empty"]').first();
  const cellBox = await emptyCell.boundingBox();
  if (!cellBox) throw new Error("empty cell not visible");

  // Grab the "5" digit from the numpad and drag it over the empty cell.
  const digit = page.getByRole("button", { name: /^5(,|$)/ }).first();
  const digitBox = await digit.boundingBox();
  if (!digitBox) throw new Error("digit not visible");

  await page.mouse.move(
    digitBox.x + digitBox.width / 2,
    digitBox.y + digitBox.height / 2,
  );
  await page.mouse.down();
  // Drag straight up — perpendicular to the horizontal numpad — to convert
  // the press into a drag (along-axis motion would skim instead). Stay
  // inside the button so the pointermove handler still fires before
  // pointerleave kills the press.
  await page.mouse.move(
    digitBox.x + digitBox.width / 2,
    digitBox.y + digitBox.height / 2 - 22,
    { steps: 3 },
  );
  // Hover over the target cell so it shows the valid-drop highlight
  await page.mouse.move(
    cellBox.x + cellBox.width / 2,
    cellBox.y + cellBox.height / 2,
    { steps: 8 },
  );

  await page.screenshot({
    path: screenshotPath("solo-drag-from-numpad", testInfo.project.name),
  });

  await page.mouse.up();
});

test("drag from numpad commits the digit on drop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  const emptyCell = page.locator('button[aria-label*=", empty"]').first();
  const cellPrefix = (await emptyCell.getAttribute("aria-label"))?.split(
    ",",
  )[0];
  if (!cellPrefix) throw new Error("empty cell has no accessible name");
  const cellBox = await emptyCell.boundingBox();
  if (!cellBox) throw new Error("empty cell not visible");

  const digit = page.getByRole("button", { name: /^5(,|$)/ }).first();
  const digitBox = await digit.boundingBox();
  if (!digitBox) throw new Error("digit not visible");

  await page.mouse.move(
    digitBox.x + digitBox.width / 2,
    digitBox.y + digitBox.height / 2,
  );
  await page.mouse.down();
  // Drag straight up — perpendicular to the horizontal numpad — to start
  // the drag rather than an along-axis skim.
  await page.mouse.move(
    digitBox.x + digitBox.width / 2,
    digitBox.y + digitBox.height / 2 - 22,
    { steps: 3 },
  );
  // Aim at the top quarter of the cell: the drop zone is split at the
  // midline (top = value, bottom = note), so the exact center is a
  // boundary coin-flip.
  await page.mouse.move(
    cellBox.x + cellBox.width / 2,
    cellBox.y + cellBox.height * 0.25,
    { steps: 8 },
  );
  await page.mouse.up();

  // The dropped 5 must land in the target cell as a value. Match the
  // specific cell and allow state suffixes (e.g. ", conflict") — the
  // board is random, so the dropped digit may legitimately conflict.
  const dropped = page.locator(`button[aria-label^="${cellPrefix}, value 5"]`);
  if ((await dropped.count()) === 0) {
    const after = await page
      .locator(`button[aria-label^="${cellPrefix},"]`)
      .first()
      .getAttribute("aria-label");
    throw new Error(`drop did not commit a value; cell is now: ${after}`);
  }
});

test("solo game - drag from a filled cell", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  const sourceCell = page.locator('button[aria-label*=", value"]').first();
  const sourceBox = await sourceCell.boundingBox();
  if (!sourceBox) throw new Error("source cell not visible");

  const emptyCell = page.locator('button[aria-label*=", empty"]').first();
  const emptyBox = await emptyCell.boundingBox();
  if (!emptyBox) throw new Error("empty cell not visible");

  // Press the source cell and move past the small slop threshold —
  // any movement on a filled cell instantly converts into a digit
  // drag (no hold required, since the cell already has a value to
  // carry).
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 10,
    sourceBox.y + sourceBox.height / 2,
    { steps: 2 },
  );
  await page.mouse.move(
    emptyBox.x + emptyBox.width / 2,
    emptyBox.y + emptyBox.height / 2,
    { steps: 8 },
  );

  await page.screenshot({
    path: screenshotPath("solo-drag-from-cell", testInfo.project.name),
  });

  await page.mouse.up();
});

test("solo game - in progress with notes", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  const emptyCells = page.locator('button[aria-label*=", empty"]');
  const enabledNumpad = page.locator(
    '[role="group"][aria-label="Number pad"]:visible button:not([disabled])',
  );

  // Fill the first few empty cells with values via the keyboard.
  for (let i = 0; i < 5; i++) {
    await emptyCells.nth(0).click();
    await page.keyboard.press(String((i % 9) + 1));
  }

  // Add pencil notes to subsequent cells by holding numpad digits past
  // the threshold — hold = note.
  const remainingEmpty = page.locator('button[aria-label*=", empty"]');
  for (let i = 0; i < 6; i++) {
    const count = await enabledNumpad.count();
    if (count < 2) break;
    await remainingEmpty.nth(i).click();
    await holdNumpadDigit(page, enabledNumpad.nth(i % count));
    await holdNumpadDigit(page, enabledNumpad.nth((i + 1) % count));
  }

  // Deselect by clicking a filled cell for cleaner screenshot
  await page.locator('button[aria-label*="value"]').first().click();

  await page.screenshot({
    path: screenshotPath("solo-in-progress", testInfo.project.name),
  });
});

test.describe("solo win modal", () => {
  // Seed a real save one cell from done plus two slower prior wins, so
  // a single keypress produces the genuine GameResult dialog — real
  // markup, "New Personal Best!" line, and populated stat tiles.
  test.use({
    storage: {
      "sudoku_save_e2e-win": nearlyWonSave,
      sudoku_stats: priorEasyStats,
    },
  });

  test("solo game - win modal", async ({ page }, testInfo) => {
    await page.goto("/solo/easy/e2e-win");
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );

    await page.locator('button[aria-label*=", empty"]').click();
    await page.keyboard.press("5");

    const dialog = page.getByRole("dialog");
    await dialog.getByText("You Won!").waitFor();
    await dialog.getByText("New Personal Best!").waitFor();

    await page.screenshot({
      path: screenshotPath("solo-win-modal", testInfo.project.name),
    });
  });
});

test.describe("solo challenge link", () => {
  // The same one-cell-from-done save the win-modal scene uses, opened
  // through a real challenge link: 03:42 beats the seeded 04:12.
  test.use({
    storage: {
      "sudoku_save_e2e-win": nearlyWonSave,
      sudoku_stats: priorEasyStats,
    },
  });

  test("solo game - challenge banner", async ({ page }, testInfo) => {
    await page.goto("/solo/easy/e2e-win?t=252&by=Swift+Panda");
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );
    await page
      .getByText("Swift Panda solved this in 04:12. Beat it!")
      .waitFor();

    await page.screenshot({
      path: screenshotPath("solo-challenge-banner", testInfo.project.name),
    });
  });

  test("solo game - challenge win modal", async ({ page }, testInfo) => {
    await page.goto("/solo/easy/e2e-win?t=252&by=Swift+Panda");
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );

    await page.locator('button[aria-label*=", empty"]').click();
    await page.keyboard.press("5");

    const dialog = page.getByRole("dialog");
    await dialog.getByText(/You beat Swift Panda/).waitFor();
    await dialog.getByRole("button", { name: "Challenge a friend" }).waitFor();

    await page.screenshot({
      path: screenshotPath("solo-challenge-win", testInfo.project.name),
    });
  });
});

// --- Multiplayer: real two-tab session ---
//
// y-webrtc syncs same-origin tabs over a BroadcastChannel, so two pages
// in one browser context form a real room with no signaling server —
// the offline route guard stays intact. localStorage is shared between
// the tabs, so each tab asserts its own player identity via init
// script before it loads (the host reads its identity at mount, before
// the guest overwrites the shared keys). The guest renders in dark
// mode via emulated prefers-color-scheme — NOT via the sudoku_theme
// storage key, which the host would pick up too when GameLayout's
// useDarkMode instance mounts — so one session yields both light and
// dark captures.

const HOST_IDENTITY = {
  sudoku_player_id: "e2e-host-0001",
  sudoku_player_name: "Clever Fox",
};

const GUEST_IDENTITY = {
  sudoku_player_id: "e2e-guest-0002",
  sudoku_player_name: "Brave Otter",
};

test.describe("multiplayer session", () => {
  test.use({ storage: HOST_IDENTITY });

  test("multiplayer - two-tab game: progress, settings, finish", async ({
    page,
    context,
  }, testInfo) => {
    // Drives ~50 real moves across two tabs — well beyond the default
    // per-test budget, especially on CI runners.
    test.setTimeout(120_000);
    const project = testInfo.project.name;

    // Host creates a room and lands in the lobby.
    await page.goto("/");
    await page.getByRole("button", { name: "Create Game" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    await page.getByRole("heading", { name: "Game Lobby" }).waitFor();
    const roomId = new URL(page.url()).pathname.slice(1);

    // Guest joins from a second tab in the same context.
    const guest = await context.newPage();
    await preparePage(guest, GUEST_IDENTITY);
    await guest.emulateMedia({ colorScheme: "dark" });
    await guest.goto(`/${roomId}`);
    await guest.getByRole("heading", { name: "Game Lobby" }).waitFor();

    // Both lobbies must see both players before the host can start.
    await page.getByText("Brave Otter").waitFor();
    await guest.getByText("Clever Fox").waitFor();

    await page.getByRole("button", { name: "Start Game" }).click();
    await page.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );
    await guest.waitForSelector(
      '[role="group"][aria-label="Number pad"]:visible',
    );

    // Read the shared puzzle off the board and solve it so both tabs
    // can make real, correct moves.
    const puzzle = await readBoard(page);
    const solution = solvePuzzle(puzzle);
    if (!solution) throw new Error("started multiplayer puzzle is unsolvable");
    const empties = [...puzzle].flatMap((ch, i) => (ch === "." ? [i] : []));

    // Each tab plays its own copy of the board. Host fills a few
    // cells, guest a few more, so the two progress bars land at
    // distinct non-zero percentages.
    await fillCells(page, solution, empties.slice(0, 5));
    await fillCells(guest, solution, empties.slice(0, 12));

    await page.getByText("Opponent", { exact: true }).waitFor();
    await guest.getByText("Opponent", { exact: true }).waitFor();
    await page.screenshot({
      path: screenshotPath("multiplayer-progress-bars", project),
    });
    await guest.screenshot({
      path: screenshotPath("multiplayer-progress-bars-dark", project),
    });

    // The settings popover carries the real opponent-bar toggle.
    await page.getByLabel("Settings").click();
    await page.getByRole("switch", { name: "Opponent bar" }).waitFor();
    await page.screenshot({
      path: screenshotPath("multiplayer-settings-toggle", project),
    });

    // Turn it off — the bars disappear for real.
    await page.getByRole("switch", { name: "Opponent bar" }).click();
    await page.keyboard.press("Escape");
    await page
      .getByText("Opponent", { exact: true })
      .waitFor({ state: "hidden" });
    await page.screenshot({
      path: screenshotPath("multiplayer-progress-hidden", project),
    });

    // Back on for the finish scene.
    await page.getByLabel("Settings").click();
    await page.getByRole("switch", { name: "Opponent bar" }).click();
    await page.keyboard.press("Escape");

    // Guest completes their board: the guest gets the real result
    // dialog, and the host sees the real finished-first banner while
    // their own board stays playable.
    await fillCells(guest, solution, empties.slice(12));
    await guest.getByRole("dialog").getByText("You Won!").waitFor();
    await page.getByText(/finished first/).waitFor();
    await page.screenshot({
      path: screenshotPath("multiplayer-opponent-finished-banner", project),
    });

    await guest.close();
  });
});

test("solo game - settings popover open", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

  await page.getByLabel("Settings").click();
  await page.getByLabel("Close settings").waitFor();

  await page.screenshot({
    path: screenshotPath("solo-settings-popover", testInfo.project.name),
  });
});

test.describe("stats with multiplayer history", () => {
  test.use({
    storage: {
      sudoku_stats: JSON.stringify([
        {
          difficulty: "easy",
          assistLevel: "paper",
          time: 240,
          date: "2026-05-10",
          won: true,
        },
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 180,
          date: "2026-05-12",
          won: true,
        },
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 165,
          date: "2026-05-14",
          won: true,
        },
        {
          difficulty: "medium",
          assistLevel: "standard",
          time: 320,
          date: "2026-05-15",
          won: true,
        },
        {
          difficulty: "medium",
          assistLevel: "full",
          time: 280,
          date: "2026-05-17",
          won: true,
        },
        {
          difficulty: "hard",
          assistLevel: "full",
          time: 540,
          date: "2026-05-18",
          won: true,
        },
      ]),
      sudoku_multiplayer_stats: JSON.stringify([
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 240,
          date: "2026-05-11",
          timestamp: 1_715_400_000_000,
          won: true,
          opponentName: "Clever Fox",
          roomId: "room-1",
          gameNumber: 1,
        },
        {
          difficulty: "medium",
          assistLevel: "standard",
          time: 360,
          date: "2026-05-13",
          timestamp: 1_715_600_000_000,
          won: false,
          opponentName: "Brave Otter",
          roomId: "room-2",
          gameNumber: 1,
        },
        {
          difficulty: "medium",
          assistLevel: "standard",
          time: 295,
          date: "2026-05-16",
          timestamp: 1_715_900_000_000,
          won: true,
          opponentName: "Brave Otter",
          roomId: "room-2",
          gameNumber: 2,
        },
        {
          difficulty: "hard",
          assistLevel: "full",
          time: 480,
          date: "2026-05-18",
          timestamp: 1_716_100_000_000,
          won: true,
          opponentName: "Swift Hawk",
          roomId: "room-3",
          gameNumber: 1,
        },
        {
          difficulty: "hard",
          assistLevel: "standard",
          time: 510,
          date: "2026-05-19",
          timestamp: 1_716_200_000_000,
          won: false,
          opponentName: "Lucky Bear",
          roomId: "room-4",
          gameNumber: 1,
        },
      ]),
    },
  });

  test("stats page with multiplayer", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: /view stats/i }).click();
    await page.getByRole("heading", { name: "Stats" }).waitFor();
    await page.screenshot({
      path: screenshotPath("stats-multiplayer", testInfo.project.name),
      fullPage: true,
    });
  });
});
