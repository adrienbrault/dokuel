import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test as base } from "@playwright/test";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(name: string, project: string) {
	return join(SCREENSHOT_DIR, `${name}--${project.replace(/\s+/g, "-")}.png`);
}

// Fixture that seeds localStorage and disables CSS animations/transitions
// before the page loads. Disabling animations lets us screenshot the final
// state immediately, instead of waiting for staggered cell-reveal animations
// (~630ms) and entry transitions.
const test = base.extend<{ storage: Record<string, string> }>({
	storage: [{}, { option: true }],
	page: async ({ page, storage }, use) => {
		const entries = Object.entries(storage);
		if (entries.length > 0) {
			await page.addInitScript((items: [string, string][]) => {
				for (const [k, v] of items) {
					localStorage.setItem(k, v);
				}
			}, entries);
		}
		await page.addInitScript(() => {
			const style = document.createElement("style");
			style.textContent = `*, *::before, *::after {
				animation-duration: 0s !important;
				animation-delay: 0s !important;
				transition-duration: 0s !important;
				transition-delay: 0s !important;
			}`;
			const inject = () => document.head.appendChild(style);
			if (document.head) inject();
			else document.addEventListener("DOMContentLoaded", inject);
		});
		await use(page);
	},
});

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
		await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
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
		await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
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
		await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
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

	test("multiplayer - dual progress bars (dark mode)", async ({
		page,
	}, testInfo) => {
		await page.goto("/");
		await page.getByRole("button", { name: "Start Solo" }).click();
		await page.getByRole("button", { name: "Easy" }).click();
		await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

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

		await page.screenshot({
			path: screenshotPath(
				"multiplayer-progress-bars-dark",
				testInfo.project.name,
			),
		});
	});
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

test("solo game - in progress with notes", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Start Solo" }).click();
	await page.getByRole("button", { name: "Easy" }).click();
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

	const emptyCells = page.locator('button[aria-label*=", empty"]');
	const enabledNumpad = page.locator(
		'[role="group"][aria-label="Number pad"]:visible button:not([disabled])',
	);
	const enabledCount = await enabledNumpad.count();

	// Fill first few empty cells with values
	for (let i = 0; i < 5; i++) {
		await emptyCells.nth(0).click();
		await enabledNumpad.nth(i % enabledCount).click();
	}

	await page.getByRole("button", { name: "Notes" }).click();

	const remainingEmpty = page.locator('button[aria-label*=", empty"]');
	for (let i = 0; i < 6; i++) {
		const count = await enabledNumpad.count();
		if (count < 2) break;
		await remainingEmpty.nth(i).click();
		await enabledNumpad.nth(i % count).click();
		await enabledNumpad.nth((i + 1) % count).click();
		if (i % 2 === 0 && count > 2) {
			await enabledNumpad.nth((i + 2) % count).click();
		}
	}

	// Deselect by clicking a filled cell for cleaner screenshot
	await page.locator('button[aria-label*="value"]').first().click();

	await page.screenshot({
		path: screenshotPath("solo-in-progress", testInfo.project.name),
	});
});

test("solo game - win modal", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Start Solo" }).click();
	await page.getByRole("button", { name: "Easy" }).click();
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

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

	await page.screenshot({
		path: screenshotPath("solo-win-modal", testInfo.project.name),
	});
});

// --- Multiplayer progress bar mockups ---

test("multiplayer - dual progress bars", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Start Solo" }).click();
	await page.getByRole("button", { name: "Easy" }).click();
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

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

	await page.screenshot({
		path: screenshotPath("multiplayer-progress-bars", testInfo.project.name),
	});
});

test("multiplayer - progress bars hidden", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Start Solo" }).click();
	await page.getByRole("button", { name: "Easy" }).click();
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

	await page.screenshot({
		path: screenshotPath("multiplayer-progress-hidden", testInfo.project.name),
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

test("multiplayer - settings with opponent bar toggle", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Start Solo" }).click();
	await page.getByRole("button", { name: "Easy" }).click();
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

	await page.getByLabel("Settings").click();
	await page.locator(".absolute.right-0.top-full").waitFor();

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
		const numpadSection = popover.querySelector("p + div");
		if (numpadSection) {
			numpadSection.after(section);
		} else {
			popover.appendChild(section);
		}
	});

	await page.screenshot({
		path: screenshotPath(
			"multiplayer-settings-toggle",
			testInfo.project.name,
		),
	});
});
