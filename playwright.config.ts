import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	outputDir: "./e2e/results",
	snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
	use: {
		baseURL: "http://localhost:5173",
	},
	webServer: {
		command: "bun run dev",
		port: 5173,
		reuseExistingServer: true,
	},
	projects: [
		{
			name: "iPhone SE",
			use: { ...devices["iPhone SE"] },
		},
		{
			name: "iPhone 14",
			use: { ...devices["iPhone 14"] },
		},
		{
			name: "iPad Mini",
			use: { ...devices["iPad Mini"] },
		},
		{
			name: "Desktop",
			use: {
				viewport: { width: 1280, height: 800 },
			},
		},
	],
});
