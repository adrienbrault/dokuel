import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Locator, type Page, test as base } from "@playwright/test";
import { encodeChallenge } from "../src/lib/challenge.ts";
import type { Challenge } from "../src/lib/types.ts";

const SCREENSHOT_DIR = join(import.meta.dirname, "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function screenshotPath(name: string, project: string) {
	return join(SCREENSHOT_DIR, `${name}--${project.replace(/\s+/g, "-")}.png`);
}

// Press and hold a numpad digit past the 200ms threshold so it commits a
// pencil note. A quick click commits the value instead.
async function holdNumpadDigit(page: Page, digit: Locator) {
	const box = await digit.boundingBox();
	if (!box) throw new Error("numpad digit not visible");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(250);
	await page.mouse.up();
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

	test("solo game - cell selected with same number highlight (dark mode)", async ({
		page,
	}, testInfo) => {
		await page.goto("/");
		await page.getByRole("button", { name: "Start Solo" }).click();
		await page.getByRole("button", { name: "Easy" }).click();
		await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

		// Click on a filled cell so that:
		// - That cell becomes selected (cell-selected bg)
		// - Same-number cells get highlighted (cell-same-number bg)
		// - Row/col/box cells get highlighted (cell-highlight bg)
		await page.locator('button[aria-label*="value"]').first().click();

		await page.screenshot({
			path: screenshotPath("solo-cell-selected-dark", testInfo.project.name),
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
	await page.mouse.move(
		cellBox.x + cellBox.width / 2,
		cellBox.y + cellBox.height / 2,
		{ steps: 8 },
	);
	await page.mouse.up();

	// After dropping the 5 on the empty cell, it should now be a value-5 cell.
	const droppedCell = page.locator('button[aria-label$="value 5"]');
	const count = await droppedCell.count();
	if (count === 0) throw new Error("drop did not commit a value");
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
	const enabledCount = await enabledNumpad.count();

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

// --- Async challenge ---

const CHALLENGE_FIXTURE: Challenge = {
	v: 1,
	puzzle:
		"53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
	difficulty: "medium",
	assistLevel: "standard",
	challengerName: "clever-otter",
	finalTime: 272,
	hintsUsed: 0,
	ghost: [
		{ t: 0, p: 0 },
		{ t: 60, p: 25 },
		{ t: 150, p: 60 },
		{ t: 272, p: 100 },
	],
};

const CHALLENGE_SOLUTION =
	"534678912672195348198342567859761423426853791713924856961537284287419635345286179";

test("challenge game - racing the ghost", async ({ page }, testInfo) => {
	const blob = await encodeChallenge(CHALLENGE_FIXTURE);
	await page.goto(`/challenge#${blob}`);
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');
	await page.screenshot({
		path: screenshotPath("challenge-game", testInfo.project.name),
	});
});

test("challenge result - head to head", async ({ page }, testInfo) => {
	const blob = await encodeChallenge(CHALLENGE_FIXTURE);
	await page.goto(`/challenge#${blob}`);
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

	// Solve the board so the result screen — and its comparison — render.
	for (let i = 0; i < 81; i++) {
		if (CHALLENGE_FIXTURE.puzzle[i] !== ".") continue;
		const r = Math.floor(i / 9) + 1;
		const c = (i % 9) + 1;
		await page
			.getByRole("button", { name: `Cell row ${r} column ${c}, empty` })
			.click();
		await page.keyboard.press(CHALLENGE_SOLUTION[i] as string);
	}

	await page.getByText(/You Won|Puzzle Complete/).waitFor();
	await page.screenshot({
		path: screenshotPath("challenge-result", testInfo.project.name),
	});
});

test("challenge unavailable - invalid link", async ({ page }, testInfo) => {
	await page.goto("/challenge#not-a-real-blob");
	await page.getByRole("heading", { name: "Challenge unavailable" }).waitFor();
	await page.screenshot({
		path: screenshotPath("challenge-error", testInfo.project.name),
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

test("multiplayer - opponent finished banner", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Start Solo" }).click();
	await page.getByRole("button", { name: "Easy" }).click();
	await page.waitForSelector('[role="group"][aria-label="Number pad"]:visible');

	await page.evaluate(() => {
		const header = document.querySelector(
			".flex.items-center.justify-between.w-full",
		);
		if (!header) return;

		const banner = document.createElement("div");
		banner.className =
			"w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-2 mx-auto";
		banner.innerHTML = `
			<div class="px-3 py-2 rounded-lg bg-bg-raised border border-border-default text-sm text-text-secondary text-center">
				<span class="font-semibold text-text-primary">Alice</span>
				finished first — keep going to complete your puzzle.
			</div>
		`;
		header.after(banner);
	});

	await page.screenshot({
		path: screenshotPath(
			"multiplayer-opponent-finished-banner",
			testInfo.project.name,
		),
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
