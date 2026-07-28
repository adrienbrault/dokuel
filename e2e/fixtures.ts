import { type Locator, type Page, test as base } from "@playwright/test";

/**
 * Shared Playwright fixture + board helpers for the e2e specs.
 *
 * The `storage` option seeds localStorage before the app loads; the
 * `page` fixture applies `preparePage`, which every extra tab opened
 * via `context.newPage()` (multiplayer flows) must also go through so
 * all pages get the same offline guarantee and animation-free
 * rendering.
 */

// Fixture that seeds localStorage and disables CSS animations/transitions
// before the page loads. Disabling animations lets us screenshot the final
// state immediately, instead of waiting for staggered cell-reveal animations
// (~630ms) and entry transitions.
export async function preparePage(
	page: Page,
	storage: Record<string, string>,
): Promise<void> {
	// The app is fully self-contained; any external request in a test
	// is a mistake (and a flake source on CI). Fail it fast instead of
	// letting the navigation "load" event wait on a third party.
	await page.route(
		(url) => !["localhost", "127.0.0.1"].includes(url.hostname),
		(route) => route.abort(),
	);
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
}

export const test = base.extend<{ storage: Record<string, string> }>({
	storage: [{}, { option: true }],
	page: async ({ page, storage }, use) => {
		await preparePage(page, storage);
		await use(page);
	},
});

// Press and hold a numpad digit past the 200ms threshold so it commits a
// pencil note into the selected cell.
export async function holdNumpadDigit(
	page: Page,
	digit: Locator,
): Promise<void> {
	const box = await digit.boundingBox();
	if (!box) throw new Error("numpad digit not visible");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(250);
	await page.mouse.up();
}

/**
 * Reads the 81-cell board out of the live DOM as a puzzle string
 * ("." for empty), by parsing the cells' accessible names. Works for
 * both solo and multiplayer boards.
 */
export async function readBoard(page: Page): Promise<string> {
	const labels = await page
		.locator('button[aria-label^="Cell row"]')
		.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
	if (labels.length !== 81) {
		throw new Error(`expected 81 board cells, saw ${labels.length}`);
	}
	const grid: string[] = Array(81).fill(".");
	for (const label of labels) {
		const m = label.match(/^Cell row (\d) column (\d), (?:value (\d)|empty)/);
		if (!m) throw new Error(`unparseable cell label: ${label}`);
		const idx = (Number(m[1]) - 1) * 9 + (Number(m[2]) - 1);
		if (m[3]) grid[idx] = m[3];
	}
	return grid.join("");
}

/**
 * Fills the given empty-cell indices with their solution digits by
 * tapping the cell and then the numpad — the input path a phone player
 * uses, and the only one multiplayer supports (no keyboard hook there).
 */
export async function fillCells(
	page: Page,
	solution: string,
	indices: number[],
): Promise<void> {
	const pad = page.locator('[role="group"][aria-label="Number pad"]:visible');
	for (const idx of indices) {
		const row = Math.floor(idx / 9) + 1;
		const col = (idx % 9) + 1;
		await page
			.locator(`button[aria-label^="Cell row ${row} column ${col},"]`)
			.click();
		await pad
			.getByRole("button", { name: new RegExp(`^${solution[idx]}(,|$)`) })
			.click();
	}
}

// A solved grid (the same one the unit tests pin). The win-modal and
// gameplay flows seed a save missing only cell (0,0) — whose value is
// 5 — so a single real keypress completes the board and opens the real
// result dialog.
export const SOLVED_GRID =
	"534678912" +
	"672195348" +
	"198342567" +
	"859761423" +
	"426853791" +
	"713924856" +
	"961537284" +
	"287419635" +
	"345286179";

export const NEARLY_DONE_PUZZLE = `.${SOLVED_GRID.slice(1)}`;

/** SavedGame JSON for a one-cell-from-done easy game at 03:42. */
export const nearlyWonSave = JSON.stringify({
	puzzle: NEARLY_DONE_PUZZLE,
	values: ".".repeat(81),
	notes: Array.from({ length: 81 }, () => []),
	timer: 222,
	difficulty: "easy",
	assistLevel: "standard",
	hintsUsed: 0,
});

/** Two prior easy wins, both slower than the seeded save's 03:42, so a
 *  completion is a genuine "New Personal Best!" with real stat tiles. */
export const priorEasyStats = JSON.stringify([
	{
		difficulty: "easy",
		assistLevel: "standard",
		time: 300,
		date: "2026-05-10",
		won: true,
	},
	{
		difficulty: "easy",
		assistLevel: "standard",
		time: 330,
		date: "2026-05-12",
		won: true,
	},
]);
