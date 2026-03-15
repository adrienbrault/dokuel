import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Page, test } from "@playwright/test";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(name: string, project: string) {
  return join(SCREENSHOT_DIR, `${name}--${project.replace(/\s+/g, "-")}.png`);
}

// --- Helpers ---

/** Set localStorage entries before the page loads (avoids a double goto). */
async function setLocalStorage(page: Page, entries: [string, string][]) {
  await page.addInitScript((items: [string, string][]) => {
    for (const [key, value] of items) {
      localStorage.setItem(key, value);
    }
  }, entries);
}

/** Wait for the landing page to be interactive. */
async function waitForLanding(page: Page) {
  await page.getByText("Start Solo").waitFor();
}

/** Wait for the Sudoku board to be rendered. */
async function waitForBoard(page: Page) {
  await page.getByRole("region", { name: "Sudoku board" }).waitFor();
}

/** Navigate to "/" and wait for the landing page. */
async function gotoLanding(page: Page) {
  await page.goto("/");
  await waitForLanding(page);
}

/** Full flow from landing to a started Easy solo game. */
async function gotoSoloGame(page: Page) {
  await gotoLanding(page);
  await page.getByText("Start Solo").click();
  await page.getByText("Easy").click();
  await waitForBoard(page);
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

// --- Tests ---

test("landing page", async ({ page }, testInfo) => {
  await gotoLanding(page);
  await page.screenshot({
    path: screenshotPath("landing", testInfo.project.name),
  });
});

test("solo game", async ({ page }, testInfo) => {
  await gotoSoloGame(page);
  await page.screenshot({
    path: screenshotPath("solo-game", testInfo.project.name),
  });
});

test("solo game - numpad left", async ({ page }, testInfo) => {
  await setLocalStorage(page, [["sudoku-numpad-position", "left"]]);
  await gotoSoloGame(page);
  await page.screenshot({
    path: screenshotPath("solo-numpad-left", testInfo.project.name),
  });
});

test("solo game - numpad right", async ({ page }, testInfo) => {
  await setLocalStorage(page, [["sudoku-numpad-position", "right"]]);
  await gotoSoloGame(page);
  await page.screenshot({
    path: screenshotPath("solo-numpad-right", testInfo.project.name),
  });
});

test("difficulty picker", async ({ page }, testInfo) => {
  await gotoLanding(page);
  await page.getByText("Start Solo").click();
  await page.getByText("Easy").waitFor();
  await page.screenshot({
    path: screenshotPath("difficulty", testInfo.project.name),
  });
});

test("multiplayer lobby", async ({ page }, testInfo) => {
  await gotoLanding(page);
  await page.getByText("Create Game").click();
  await page.getByText("Easy").waitFor();
  await page.getByText("Easy").click();
  await page.getByText("Game Lobby").waitFor();
  await page.screenshot({
    path: screenshotPath("multiplayer-lobby", testInfo.project.name),
  });
});

test("about page", async ({ page }, testInfo) => {
  await page.goto("/about");
  await page.waitForLoadState("domcontentloaded");
  await page.screenshot({
    path: screenshotPath("about", testInfo.project.name),
    fullPage: true,
  });
});

test("about page - dark mode", async ({ page }, testInfo) => {
  await setLocalStorage(page, [["sudoku_theme", "dark"]]);
  await page.goto("/about");
  await page.waitForLoadState("domcontentloaded");
  await page.screenshot({
    path: screenshotPath("about-dark", testInfo.project.name),
    fullPage: true,
  });
});

// --- Dark mode variants ---

test("landing page - dark mode", async ({ page }, testInfo) => {
  await setLocalStorage(page, [["sudoku_theme", "dark"]]);
  await gotoLanding(page);
  await page.screenshot({
    path: screenshotPath("landing-dark", testInfo.project.name),
  });
});

test("solo game - dark mode", async ({ page }, testInfo) => {
  await setLocalStorage(page, [["sudoku_theme", "dark"]]);
  await gotoSoloGame(page);
  await page.screenshot({
    path: screenshotPath("solo-game-dark", testInfo.project.name),
  });
});

test("difficulty picker - dark mode", async ({ page }, testInfo) => {
  await setLocalStorage(page, [["sudoku_theme", "dark"]]);
  await gotoLanding(page);
  await page.getByText("Start Solo").click();
  await page.getByText("Easy").waitFor();
  await page.screenshot({
    path: screenshotPath("difficulty-dark", testInfo.project.name),
  });
});

// --- Missing screens ---

test("daily challenge", async ({ page }, testInfo) => {
  await gotoLanding(page);
  await page.getByRole("button", { name: /Daily Challenge/ }).click();
  await waitForBoard(page);
  await page.screenshot({
    path: screenshotPath("daily-challenge", testInfo.project.name),
  });
});

test("join game screen", async ({ page }, testInfo) => {
  await gotoLanding(page);
  await page.getByText("Join Game").click();
  await page.getByRole("heading", { name: "Join Game" }).waitFor();
  await page.screenshot({
    path: screenshotPath("join-game", testInfo.project.name),
  });
});

// --- Game states ---

test("solo game - in progress with notes", async ({ page }, testInfo) => {
  await gotoSoloGame(page);

  // Find empty cells and fill some with values, others with notes
  const emptyCells = page.locator('button[aria-label*=", empty"]');
  const count = await emptyCells.count();

  // Helper to click elements that may be off-screen (e.g. numpad on desktop layout)
  const forceClick = (loc: import("@playwright/test").Locator) =>
    loc.evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

  // Fill first few empty cells with values (click cell, then numpad number)
  for (let i = 0; i < Math.min(5, count); i++) {
    await forceClick(emptyCells.nth(0)); // always nth(0) since filled cells lose "empty" label
    const numButton = page
      .locator('[role="group"][aria-label="Number pad"] button')
      .nth(i % 9);
    await forceClick(numButton);
    await page.waitForTimeout(50);
  }

  // Toggle notes mode
  await forceClick(page.getByLabel("Notes").first());

  // Add notes to several empty cells
  const remainingEmpty = page.locator('button[aria-label*=", empty"]');
  const remainingCount = await remainingEmpty.count();
  const enabledNumpad = page.locator(
    '[role="group"][aria-label="Number pad"] button:not([disabled])',
  );
  for (let i = 0; i < Math.min(6, remainingCount); i++) {
    await forceClick(remainingEmpty.nth(i));
    // Add 2-3 note candidates per cell from enabled buttons
    const enabledCount = await enabledNumpad.count();
    if (enabledCount < 2) break;
    await forceClick(enabledNumpad.nth(i % enabledCount));
    await page.waitForTimeout(30);
    await forceClick(enabledNumpad.nth((i + 1) % enabledCount));
    await page.waitForTimeout(30);
    if (i % 2 === 0 && enabledCount > 2) {
      await forceClick(enabledNumpad.nth((i + 2) % enabledCount));
      await page.waitForTimeout(30);
    }
  }

  // Deselect by clicking a filled cell for cleaner screenshot
  await forceClick(page.locator('button[aria-label*="value"]').first());
  await page.waitForTimeout(300);

  await page.screenshot({
    path: screenshotPath("solo-in-progress", testInfo.project.name),
  });
});

test("solo game - win modal", async ({ page }, testInfo) => {
  await gotoSoloGame(page);

  // Inject the GameResult modal overlay directly into the DOM.
  // This matches the markup from GameResult.tsx and lets us screenshot
  // the win state without needing to solve the puzzle programmatically.
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

  await page.waitForTimeout(150);
  await page.screenshot({
    path: screenshotPath("solo-win-modal", testInfo.project.name),
  });
});

// --- Multiplayer progress bar mockups ---

test("multiplayer - dual progress bars", async ({ page }, testInfo) => {
  await gotoSoloGame(page);

  // Inject dual progress bars above the board to simulate multiplayer view
  await injectProgressBars(page);

  await page.locator("text=42%").waitFor();
  await page.screenshot({
    path: screenshotPath("multiplayer-progress-bars", testInfo.project.name),
  });
});

test("multiplayer - dual progress bars (dark mode)", async ({
  page,
}, testInfo) => {
  await setLocalStorage(page, [["sudoku_theme", "dark"]]);
  await gotoSoloGame(page);

  // Inject dual progress bars
  await injectProgressBars(page);

  await page.locator("text=42%").waitFor();
  await page.screenshot({
    path: screenshotPath(
      "multiplayer-progress-bars-dark",
      testInfo.project.name,
    ),
  });
});

test("multiplayer - progress bars hidden", async ({ page }, testInfo) => {
  await gotoSoloGame(page);

  // No progress bars injected — this represents the "hidden" state
  await page.screenshot({
    path: screenshotPath(
      "multiplayer-progress-hidden",
      testInfo.project.name,
    ),
  });
});

test("solo game - assist level popover", async ({ page }, testInfo) => {
  await gotoSoloGame(page);

  // Open assist level setting popover
  await page.getByLabel("Assist level").click();
  await page.getByRole("radiogroup", { name: "Assistance level" }).waitFor();

  await page.screenshot({
    path: screenshotPath("solo-assist-popover", testInfo.project.name),
  });
});
