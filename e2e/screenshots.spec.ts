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
