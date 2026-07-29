import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Everything vite build consumes. A change to the HTML shell, static
// assets, or the build config produces a different bundle just as
// surely as a src/ edit does.
const INPUTS = ["src", "index.html", "public", "vite.config.ts"];
const DIST_INDEX = "dist/index.html";

function maxMtime(dir: string): number {
  let max = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) max = Math.max(max, maxMtime(path));
    else max = Math.max(max, statSync(path).mtimeMs);
  }
  return max;
}

function mtimeOf(path: string): number {
  const stat = statSync(path);
  return stat.isDirectory() ? maxMtime(path) : stat.mtimeMs;
}

export default function checkBuildFresh() {
  let distMtime: number;
  try {
    distMtime = statSync(DIST_INDEX).mtimeMs;
  } catch {
    throw new Error(
      `Missing ${DIST_INDEX}. Run \`bun run screenshots\` (it builds first) ` +
        `or \`bunx vite build\` before invoking playwright directly.`,
    );
  }
  for (const input of INPUTS) {
    let inputMtime: number;
    try {
      inputMtime = mtimeOf(input);
    } catch {
      continue; // optional inputs (e.g. public/) may not exist
    }
    if (inputMtime > distMtime) {
      throw new Error(
        `Stale build: ${input} is newer than ${DIST_INDEX}. ` +
          `Run \`bun run screenshots\` (it builds first) or \`bunx vite build\` to refresh.`,
      );
    }
  }
}
