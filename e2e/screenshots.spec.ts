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
