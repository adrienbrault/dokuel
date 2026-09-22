import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { solvePuzzle } from "../src/lib/sudoku.ts";
import {
  fillCells,
  holdNumpadDigit,
  inProgressSave,
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

// The host plays with the vehicles and wants the guest on them too:
// one toggle seeds the room from what they already use.
test.describe("shared digit style", () => {
  test.use({
    storage: {
      sudoku_digit_color_mode: "emoji",
      sudoku_emoji_theme: "vehicles",
    },
  });

  test("multiplayer lobby - shared digit style", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create Game" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    await page.getByRole("heading", { name: "Game Lobby" }).waitFor();
    await page.getByRole("switch", { name: "Same digits for both" }).click();
    await page.waitForSelector('[role="radiogroup"][aria-label="Emoji theme"]');
    await page.screenshot({
      path: screenshotPath("multiplayer-digit-style", testInfo.project.name),
    });
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

    // Host slips once, corrects it, and finishes: both replays now hold
    // a real game, mistake included.
    const slip = empties[5]!;
    const wrong = `${solution.slice(0, slip)}${(Number(solution[slip]) % 9) + 1}${solution.slice(slip + 1)}`;
    await fillCells(page, wrong, [slip]);
    // Erase before refilling: the slip counts against its digit, and a
    // digit placed nine times leaves the pad.
    await page.getByRole("button", { name: "Erase" }).click();
    await fillCells(page, solution, empties.slice(5));
    await page.getByRole("dialog").getByText("Puzzle Complete!").waitFor();

    // Scrub both replays to the middle of the race, where the boards
    // differ most.
    for (const [tab, name] of [
      [page, "multiplayer-replay"],
      [guest, "multiplayer-replay-dark"],
    ] as const) {
      await tab.getByRole("button", { name: "Watch Replay" }).click();
      await tab
        .getByRole("group", { name: /^Board: / })
        .first()
        .waitFor();
      const scrubber = tab.getByLabel("Replay time");
      const max = Number(await scrubber.getAttribute("max"));
      await scrubber.fill(String(Math.round(max * 0.55)));
      await tab.screenshot({ path: screenshotPath(name, project) });
    }

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

test.describe("landing with games in progress", () => {
  test.use({
    storage: {
      "sudoku_save_e2e-a": inProgressSave({
        difficulty: "hard",
        timer: 845,
        blanks: 50,
        filled: 19,
        updatedAt: Date.parse("2026-05-19T20:00:00Z"),
      }),
      "sudoku_save_e2e-b": inProgressSave({
        difficulty: "medium",
        timer: 312,
        blanks: 44,
        filled: 30,
        updatedAt: Date.parse("2026-05-18T20:00:00Z"),
      }),
      "sudoku_save_e2e-c": inProgressSave({
        difficulty: "easy",
        timer: 96,
        blanks: 38,
        filled: 5,
        updatedAt: Date.parse("2026-05-17T20:00:00Z"),
      }),
      "sudoku_save_e2e-d": inProgressSave({
        difficulty: "expert",
        timer: 1503,
        blanks: 56,
        filled: 41,
        updatedAt: Date.parse("2026-05-16T20:00:00Z"),
      }),
    },
  });

  test("landing - games in progress", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByText("Show 1 more in progress").waitFor();
    await page.screenshot({
      path: screenshotPath("landing-continue", testInfo.project.name),
    });
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
          timestamp: Date.parse("2026-05-10T19:30:00Z"),
          won: true,
        },
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 180,
          date: "2026-05-12",
          timestamp: Date.parse("2026-05-12T19:30:00Z"),
          won: true,
        },
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 165,
          date: "2026-05-14",
          timestamp: Date.parse("2026-05-14T19:30:00Z"),
          won: true,
        },
        {
          difficulty: "medium",
          assistLevel: "standard",
          time: 320,
          date: "2026-05-15",
          timestamp: Date.parse("2026-05-15T19:30:00Z"),
          won: true,
        },
        {
          difficulty: "medium",
          assistLevel: "full",
          time: 280,
          date: "2026-05-17",
          timestamp: Date.parse("2026-05-17T19:30:00Z"),
          won: true,
        },
        {
          difficulty: "hard",
          assistLevel: "full",
          time: 540,
          date: "2026-05-18",
          timestamp: Date.parse("2026-05-18T19:30:00Z"),
          won: true,
        },
      ]),
      sudoku_multiplayer_stats: JSON.stringify([
        {
          difficulty: "easy",
          assistLevel: "standard",
          time: 240,
          date: "2026-05-11",
          timestamp: Date.parse("2026-05-11T20:15:00Z"),
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
          timestamp: Date.parse("2026-05-13T20:15:00Z"),
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
          timestamp: Date.parse("2026-05-16T20:15:00Z"),
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
          timestamp: Date.parse("2026-05-18T20:15:00Z"),
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
          timestamp: Date.parse("2026-05-19T20:15:00Z"),
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
    await page.getByRole("button", { name: /stats/i }).click();
    await page.getByRole("heading", { name: "Stats" }).waitFor();
    await page.screenshot({
      path: screenshotPath("stats-multiplayer", testInfo.project.name),
      fullPage: true,
    });
  });
});

// --- Digit color modes ---

/**
 * Plays a handful of values and pencil notes into a fresh easy board,
 * so a palette screenshot shows givens, entered digits and multi-note
 * cells side by side rather than an untouched grid of givens.
 */
async function startEasy(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Solo" }).click();
  await page.getByRole("button", { name: "Easy" }).click();
  await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
}

async function playValuesAndNotes(page: Page) {
  await startEasy(page);

  const enabledNumpad = page.locator(
    '[role="group"][aria-label="Number pad"]:visible button:not([disabled])',
  );
  for (let i = 0; i < 5; i++) {
    await page.locator('button[aria-label*=", empty"]').nth(0).click();
    await page.keyboard.press(String((i % 9) + 1));
  }
  const remainingEmpty = page.locator('button[aria-label*=", empty"]');
  for (let i = 0; i < 6; i++) {
    const count = await enabledNumpad.count();
    if (count < 2) break;
    await remainingEmpty.nth(i).click();
    await holdNumpadDigit(page, enabledNumpad.nth(i % count));
    await holdNumpadDigit(page, enabledNumpad.nth((i + 1) % count));
  }
  await page.locator('button[aria-label*="value"]').first().click();
}

test.describe("digit colors tinted", () => {
  test.use({ storage: { sudoku_digit_color_mode: "digits" } });

  test("solo game - tinted digits", async ({ page }, testInfo) => {
    await playValuesAndNotes(page);
    await page.screenshot({
      path: screenshotPath("digit-colors-tinted", testInfo.project.name),
    });
  });
});

test.describe("digit colors only", () => {
  test.use({ storage: { sudoku_digit_color_mode: "colors" } });

  test("solo game - colors only", async ({ page }, testInfo) => {
    await playValuesAndNotes(page);
    await page.screenshot({
      path: screenshotPath("digit-colors-only", testInfo.project.name),
    });
  });
});

test.describe("digit colors only dark", () => {
  test.use({
    storage: { sudoku_digit_color_mode: "colors", sudoku_theme: "dark" },
  });

  test("solo game - colors only dark", async ({ page }, testInfo) => {
    await playValuesAndNotes(page);
    await page.screenshot({
      path: screenshotPath("digit-colors-only-dark", testInfo.project.name),
    });
  });
});

test.describe("digit colors settings", () => {
  test.use({ storage: { sudoku_digit_color_mode: "digits" } });

  test("solo game - digit color setting", async ({ page }, testInfo) => {
    await playValuesAndNotes(page);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForSelector(
      '[role="radiogroup"][aria-label="Digit colors"]',
    );
    await page.screenshot({
      path: screenshotPath("digit-colors-settings", testInfo.project.name),
    });
  });
});

test.describe("digit colors interactions", () => {
  test.use({ storage: { sudoku_digit_color_mode: "colors" } });

  test("solo game - colors only, note mode pad", async ({ page }, testInfo) => {
    await startEasy(page);

    // Drag across two cells to arm a multi-cell selection, which flips
    // the pad into note mode and swaps in the pencil-mark key faces.
    const cells = page.locator('button[aria-label*=", empty"]');
    const from = await cells.nth(0).boundingBox();
    const to = await cells.nth(1).boundingBox();
    if (!from || !to) throw new Error("cells not visible");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 6,
    });
    await page.mouse.up();

    await page.screenshot({
      path: screenshotPath("digit-colors-note-mode", testInfo.project.name),
    });
  });

  test("solo game - colors only, charging a note", async ({
    page,
  }, testInfo) => {
    await startEasy(page);
    await page.locator('button[aria-label*=", empty"]').first().click();

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
      path: screenshotPath("digit-colors-charging", testInfo.project.name),
    });
    await page.mouse.up();
  });

  test("solo game - colors only, drag mid-flight", async ({
    page,
  }, testInfo) => {
    await startEasy(page);

    const cellBox = await page
      .locator('button[aria-label*=", empty"]')
      .first()
      .boundingBox();
    if (!cellBox) throw new Error("empty cell not visible");
    const digitBox = await page
      .getByRole("button", { name: /^5(,|$)/ })
      .first()
      .boundingBox();
    if (!digitBox) throw new Error("digit not visible");

    await page.mouse.move(
      digitBox.x + digitBox.width / 2,
      digitBox.y + digitBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      digitBox.x + digitBox.width / 2,
      digitBox.y + digitBox.height / 2 - 22,
      { steps: 3 },
    );
    await page.mouse.move(
      cellBox.x + cellBox.width / 2,
      cellBox.y + cellBox.height / 2,
      { steps: 8 },
    );

    await page.screenshot({
      path: screenshotPath("digit-colors-drag", testInfo.project.name),
    });
    await page.mouse.up();
  });
});

// One scene per emoji theme, so the themes that turn to mush at note
// size are visible rather than assumed.
for (const theme of ["shapes", "fruit", "animals", "weather"] as const) {
  test.describe(`emoji theme ${theme}`, () => {
    test.use({
      storage: {
        sudoku_digit_color_mode: "emoji",
        sudoku_emoji_theme: theme,
      },
    });

    test(`solo game - emoji ${theme}`, async ({ page }, testInfo) => {
      await playValuesAndNotes(page);
      await page.screenshot({
        path: screenshotPath(`emoji-${theme}`, testInfo.project.name),
      });
    });
  });
}

test.describe("emoji theme settings", () => {
  test.use({ storage: { sudoku_digit_color_mode: "emoji" } });

  test("solo game - emoji theme picker", async ({ page }, testInfo) => {
    await playValuesAndNotes(page);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForSelector('[role="radiogroup"][aria-label="Emoji theme"]');
    await page.screenshot({
      path: screenshotPath("emoji-settings", testInfo.project.name),
    });
  });
});
