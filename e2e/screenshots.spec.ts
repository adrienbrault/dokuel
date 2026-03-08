import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(name: string, project: string) {
	return join(SCREENSHOT_DIR, `${name}--${project.replace(/\s+/g, "-")}.png`);
}

test("landing page", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(500);
	await page.screenshot({
		path: screenshotPath("landing", testInfo.project.name),
	});
});

test("landing page - with friends", async ({ page }, testInfo) => {
	await page.goto("/");
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
		// Also set some stats so we get returning-user view
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
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(500);
	await page.screenshot({
		path: screenshotPath("landing-friends", testInfo.project.name),
		fullPage: true,
	});
});

test("solo game", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);
	await page.screenshot({
		path: screenshotPath("solo-game", testInfo.project.name),
	});
});

test("solo game - numpad left", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.evaluate(() =>
		localStorage.setItem("sudoku-numpad-position", "left"),
	);
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);
	await page.screenshot({
		path: screenshotPath("solo-numpad-left", testInfo.project.name),
	});
});

test("solo game - numpad right", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.evaluate(() =>
		localStorage.setItem("sudoku-numpad-position", "right"),
	);
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);
	await page.screenshot({
		path: screenshotPath("solo-numpad-right", testInfo.project.name),
	});
});

test("difficulty picker", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.waitForTimeout(300);
	await page.screenshot({
		path: screenshotPath("difficulty", testInfo.project.name),
	});
});

test("multiplayer lobby", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Create Game").click();
	await page.waitForTimeout(300);
	await page.getByText("Easy").click();
	await page.waitForTimeout(1000);
	await page.screenshot({
		path: screenshotPath("multiplayer-lobby", testInfo.project.name),
	});
});

// --- Dark mode variants ---

test("landing page - dark mode", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.evaluate(() =>
		localStorage.setItem("sudoku_theme", "dark"),
	);
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(500);
	await page.screenshot({
		path: screenshotPath("landing-dark", testInfo.project.name),
	});
});

test("solo game - dark mode", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.evaluate(() =>
		localStorage.setItem("sudoku_theme", "dark"),
	);
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);
	await page.screenshot({
		path: screenshotPath("solo-game-dark", testInfo.project.name),
	});
});

test("difficulty picker - dark mode", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.evaluate(() =>
		localStorage.setItem("sudoku_theme", "dark"),
	);
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.waitForTimeout(300);
	await page.screenshot({
		path: screenshotPath("difficulty-dark", testInfo.project.name),
	});
});

// --- Missing screens ---

test("daily challenge", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Daily Challenge").click();
	await page.waitForTimeout(800);
	await page.screenshot({
		path: screenshotPath("daily-challenge", testInfo.project.name),
	});
});

test("join game screen", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Join Game").click();
	await page.waitForTimeout(300);
	await page.screenshot({
		path: screenshotPath("join-game", testInfo.project.name),
	});
});

// --- Game states ---

test("solo game - in progress with notes", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);

	// Find empty cells and fill some with values, others with notes
	const emptyCells = page.locator('button[aria-label*=", empty"]');
	const count = await emptyCells.count();

	// Fill first few empty cells with values (click cell, then numpad number)
	for (let i = 0; i < Math.min(5, count); i++) {
		await emptyCells.nth(0).click(); // always nth(0) since filled cells lose "empty" label
		const numButton = page.locator('[role="group"][aria-label="Number pad"] button').nth(i % 9);
		await numButton.click();
		await page.waitForTimeout(50);
	}

	// Toggle notes mode
	await page.getByLabel("Notes").click();

	// Add notes to several empty cells
	const remainingEmpty = page.locator('button[aria-label*=", empty"]');
	const remainingCount = await remainingEmpty.count();
	const enabledNumpad = page.locator(
		'[role="group"][aria-label="Number pad"] button:not([disabled])',
	);
	for (let i = 0; i < Math.min(6, remainingCount); i++) {
		await remainingEmpty.nth(i).click();
		// Add 2-3 note candidates per cell from enabled buttons
		const enabledCount = await enabledNumpad.count();
		if (enabledCount < 2) break;
		await enabledNumpad.nth(i % enabledCount).click();
		await page.waitForTimeout(30);
		await enabledNumpad.nth((i + 1) % enabledCount).click();
		await page.waitForTimeout(30);
		if (i % 2 === 0 && enabledCount > 2) {
			await enabledNumpad.nth((i + 2) % enabledCount).click();
			await page.waitForTimeout(30);
		}
	}

	// Deselect by clicking a filled cell for cleaner screenshot
	await page.locator('button[aria-label*="value"]').first().click();
	await page.waitForTimeout(300);

	await page.screenshot({
		path: screenshotPath("solo-in-progress", testInfo.project.name),
	});
});

test("solo game - win modal", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);

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

	await page.waitForTimeout(300);
	await page.screenshot({
		path: screenshotPath("solo-win-modal", testInfo.project.name),
	});
});

// --- Multiplayer progress bar mockups ---

test("multiplayer - dual progress bars", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);

	// Inject dual progress bars above the board to simulate multiplayer view
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

	await page.waitForTimeout(300);
	await page.screenshot({
		path: screenshotPath("multiplayer-progress-bars", testInfo.project.name),
	});
});

test("multiplayer - dual progress bars (dark mode)", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	await page.evaluate(() =>
		localStorage.setItem("sudoku_theme", "dark"),
	);
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);

	// Inject dual progress bars
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

	await page.waitForTimeout(300);
	await page.screenshot({
		path: screenshotPath(
			"multiplayer-progress-bars-dark",
			testInfo.project.name,
		),
	});
});

test("multiplayer - progress bars hidden", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);

	// No progress bars injected — this represents the "hidden" state
	await page.screenshot({
		path: screenshotPath(
			"multiplayer-progress-hidden",
			testInfo.project.name,
		),
	});
});

test("multiplayer - settings with opponent bar toggle", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByText("Start Solo").click();
	await page.getByText("Easy").click();
	await page.waitForTimeout(800);

	// Open settings popover
	await page.getByLabel("Settings").click();
	await page.waitForTimeout(200);

	// Inject the opponent bar toggle into the settings popover
	await page.evaluate(() => {
		const popover = document.querySelector(".absolute.right-0.top-full");
		if (!popover) return;

		const section = document.createElement("div");
		section.className = "mt-3 pt-3 border-t border-border-default";
		section.innerHTML = `
			<label class="flex items-center gap-3 cursor-pointer select-none touch-manipulation">
				<span class="text-sm text-text-secondary">Opponent bar</span>
				<button type="button" role="switch" aria-checked="true" aria-label="Opponent bar"
					class="relative w-11 h-6 rounded-full transition-colors duration-200 bg-accent">
					<span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 translate-x-5"></span>
				</button>
			</label>
		`;
		// Insert after numpad position section
		const numpadSection = popover.querySelector("p + div");
		if (numpadSection) {
			numpadSection.after(section);
		} else {
			popover.appendChild(section);
		}
	});

	await page.waitForTimeout(200);
	await page.screenshot({
		path: screenshotPath(
			"multiplayer-settings-toggle",
			testInfo.project.name,
		),
	});
});
