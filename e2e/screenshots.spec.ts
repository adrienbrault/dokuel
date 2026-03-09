import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Page, type TestInfo, test } from "@playwright/test";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(name: string, project: string) {
  return join(SCREENSHOT_DIR, `${name}--${project.replace(/\s+/g, "-")}.png`);
}

// --- Helpers ---

async function waitForLanding(page: Page) {
  await page.getByText("Start Solo").waitFor();
}

async function waitForBoard(page: Page) {
  await page.getByRole("region", { name: "Sudoku board" }).waitFor();
}

async function gotoLanding(page: Page) {
  await page.goto("/");
  await waitForLanding(page);
}

async function gotoSoloGame(page: Page) {
  await page.goto("/solo/easy/e2e-screenshot-test");
  await waitForBoard(page);
}

async function setDark(page: Page) {
  await page.evaluate(() => localStorage.setItem("sudoku_theme", "dark"));
}

async function clearDark(page: Page) {
  await page.evaluate(() => localStorage.removeItem("sudoku_theme"));
}

async function injectProgressBars(page: Page) {
  await page.evaluate(() => {
    const header = document.querySelector(
      ".flex.items-center.justify-between.w-full",
    );
    if (!header) return;
    const bars = document.createElement("div");
    bars.className =
      "w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-1.5 mx-auto";
    bars.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-secondary w-24 truncate">You</span>
        <div class="flex-1 h-2 rounded-full bg-bg-raised overflow-hidden">
          <div class="h-full rounded-full bg-accent transition-all duration-300" style="width: 42%"></div>
        </div>
        <span class="text-xs text-text-secondary font-mono tabular-nums w-8 text-right">42%</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-secondary w-24 truncate">Opponent</span>
        <div class="flex-1 h-2 rounded-full bg-bg-raised overflow-hidden">
          <div class="h-full rounded-full bg-rose-400 transition-all duration-300" style="width: 67%"></div>
        </div>
        <span class="text-xs text-text-secondary font-mono tabular-nums w-8 text-right">67%</span>
      </div>
    `;
    header.after(bars);
  });
}

/** Projects that capture all variants (dark mode, with-friends, etc.). */
function isPrimary(testInfo: TestInfo) {
  return ["iPhone SE", "Desktop"].includes(testInfo.project.name);
}

// --- One test per project: all screenshots captured in sequence ---
//
// Sharing a single browser context across all screenshots eliminates the
// per-test context creation cost (~1.25s each × 14 screenshots = ~17s/device).
// Variant screenshots (dark mode, numpad position) use page.reload() after
// setting localStorage — much cheaper than a new navigation.

test("all screenshots", async ({ page }, testInfo) => {
  const primary = isPrimary(testInfo);

  const shot = async (name: string, opts?: { fullPage?: boolean }) =>
    page.screenshot({
      path: screenshotPath(name, testInfo.project.name),
      ...opts,
    });

  // ---- Landing ----

  await test.step("landing", async () => {
    await gotoLanding(page);
    await shot("landing");
  });

  if (primary) {
    await test.step("landing - with friends", async () => {
      await page.evaluate(() => {
        localStorage.setItem("sudoku_player_id", "me123abc");
        localStorage.setItem(
          "sudoku_friends",
          JSON.stringify([
            {
              playerId: "friend01",
              name: "Bold Lion",
              addedAt: "2026-03-07T10:00:00Z",
            },
            {
              playerId: "friend02",
              name: "Clever Fox",
              addedAt: "2026-03-06T10:00:00Z",
            },
          ]),
        );
        localStorage.setItem(
          "sudoku_stats",
          JSON.stringify([
            {
              difficulty: "easy",
              time: 120,
              date: "2026-03-07",
              won: true,
              hintsUsed: 0,
            },
          ]),
        );
      });
      await page.reload();
      await waitForLanding(page);
      await shot("landing-friends", { fullPage: true });
      await page.evaluate(() => {
        localStorage.removeItem("sudoku_player_id");
        localStorage.removeItem("sudoku_friends");
        localStorage.removeItem("sudoku_stats");
      });
      await page.reload();
      await waitForLanding(page);
    });

    await test.step("landing - dark mode", async () => {
      await setDark(page);
      await page.reload();
      await waitForLanding(page);
      await shot("landing-dark");
      await clearDark(page);
      await page.reload();
      await waitForLanding(page);
    });
  }

  // ---- Difficulty picker ----
  // Reuse the landing page we're already on — just click through.

  await test.step("difficulty picker", async () => {
    await page.getByText("Start Solo").click();
    await page.getByText("Easy").waitFor();
    await shot("difficulty");
  });

  if (primary) {
    await test.step("difficulty picker - dark mode", async () => {
      await setDark(page);
      await gotoLanding(page);
      await page.getByText("Start Solo").click();
      await page.getByText("Easy").waitFor();
      await shot("difficulty-dark");
      await clearDark(page);
    });
  }

  // ---- Multiplayer lobby ----

  await test.step("multiplayer lobby", async () => {
    await gotoLanding(page);
    await page.getByText("Create Game").click();
    await page.getByText("Easy").waitFor();
    await page.getByText("Easy").click();
    await page.getByText("Game Lobby").waitFor();
    await shot("multiplayer-lobby");
  });

  // ---- About ----

  await test.step("about page", async () => {
    await page.goto("/about");
    await page.waitForLoadState("domcontentloaded");
    await shot("about", { fullPage: true });
  });

  if (primary) {
    await test.step("about page - dark mode", async () => {
      await setDark(page);
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await shot("about-dark", { fullPage: true });
      await clearDark(page);
    });
  }

  // ---- Daily challenge ----

  await test.step("daily challenge", async () => {
    await page.goto("/daily");
    await waitForBoard(page);
    await shot("daily-challenge");
  });

  // ---- Join game ----

  await test.step("join game screen", async () => {
    await page.goto("/join");
    await page.getByRole("heading", { name: "Join Game" }).waitFor();
    await shot("join-game");
  });

  // ---- Solo game variants ----
  // Navigate once, then reload with different localStorage for numpad/dark variants.

  await test.step("solo game", async () => {
    await gotoSoloGame(page);
    await shot("solo-game");
  });

  await test.step("solo game - numpad left", async () => {
    await page.evaluate(() =>
      localStorage.setItem("sudoku-numpad-position", "left"),
    );
    await page.reload();
    await waitForBoard(page);
    await shot("solo-numpad-left");
  });

  await test.step("solo game - numpad right", async () => {
    await page.evaluate(() =>
      localStorage.setItem("sudoku-numpad-position", "right"),
    );
    await page.reload();
    await waitForBoard(page);
    await shot("solo-numpad-right");
    await page.evaluate(() =>
      localStorage.removeItem("sudoku-numpad-position"),
    );
  });

  if (primary) {
    await test.step("solo game - dark mode", async () => {
      await setDark(page);
      await page.reload();
      await waitForBoard(page);
      await shot("solo-game-dark");
      await clearDark(page);
      await page.reload();
      await waitForBoard(page);
    });
  }

  // ---- In progress with notes ----
  // Inject a pre-built SavedGame into localStorage so the board loads
  // the desired state directly without any UI interaction.

  await test.step("solo game - in progress with notes", async () => {
    const puzzle =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const values =
      "534.78...6..19534..98....6.8.9.6...34.68.3..17...2...6.6....28....419..5....8..79";
    const notes = Array.from({ length: 81 }, (_, i) => {
      const noteMap: Record<number, number[]> = {
        3: [4, 6],
        6: [1, 9],
        7: [1, 2],
        21: [3, 4],
        33: [2, 4],
        40: [5],
        46: [1, 3],
        57: [3, 5],
      };
      return noteMap[i] ?? [];
    });
    await page.evaluate(
      (save) =>
        localStorage.setItem(
          "sudoku_save_e2e-in-progress",
          JSON.stringify(save),
        ),
      { puzzle, values, notes, timer: 187, difficulty: "easy", assistLevel: "standard" },
    );
    await page.goto("/solo/easy/e2e-in-progress");
    await waitForBoard(page);
    await shot("solo-in-progress");
  });

  // ---- Win modal ----
  // Reuse solo game page: navigate fresh, inject overlay, screenshot, reload.

  await test.step("solo game - win modal", async () => {
    await gotoSoloGame(page);
    await page.evaluate(() => {
      const overlay = document.createElement("div");
      overlay.className =
        "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6";
      overlay.innerHTML = `
        <div class="confetti-container">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="flex flex-col items-center gap-5 bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl max-w-sm sm:max-w-md w-full relative">
          <div class="flex flex-col items-center gap-2">
            <span class="text-5xl animate-emoji-bounce">🎉</span>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">You Won!</h2>
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Easy</span>
          </div>
          <div class="flex flex-col items-center gap-1">
            <span class="text-3xl font-mono font-bold tabular-nums text-gray-900 dark:text-gray-100">03:42</span>
            <span class="text-sm font-semibold text-green-600 dark:text-green-400">New Best!</span>
          </div>
          <div class="flex flex-col gap-3 w-full">
            <button type="button" class="w-full py-3 rounded-xl text-lg font-semibold bg-accent text-white select-none touch-manipulation">Play Again</button>
            <button type="button" class="w-full py-3 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 select-none touch-manipulation">New Game</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    });
    await page.locator(".fixed.inset-0.z-50").waitFor();
    await shot("solo-win-modal");
  });

  // ---- Assist level popover ----
  // Reload to clear the win modal overlay, then open the popover.

  await test.step("solo game - assist level popover", async () => {
    await page.reload();
    await waitForBoard(page);
    await page.getByLabel("Assist level").click();
    await page.getByRole("radiogroup", { name: "Assistance level" }).waitFor();
    await shot("solo-assist-popover");
  });

  // ---- Multiplayer progress bars ----
  // Reload for a clean board, then inject the progress bar DOM.

  await test.step("multiplayer - dual progress bars", async () => {
    await page.reload();
    await waitForBoard(page);
    await injectProgressBars(page);
    await page.locator("text=42%").waitFor();
    await shot("multiplayer-progress-bars");
  });

  if (primary) {
    await test.step("multiplayer - dual progress bars (dark mode)", async () => {
      await setDark(page);
      await page.reload();
      await waitForBoard(page);
      await injectProgressBars(page);
      await page.locator("text=42%").waitFor();
      await shot("multiplayer-progress-bars-dark");
      await clearDark(page);
    });
  }
});
