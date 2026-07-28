import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src";
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
  const srcMtime = maxMtime(SRC);
  if (srcMtime > distMtime) {
    throw new Error(
      `Stale build: ${SRC}/ has files newer than ${DIST_INDEX}. ` +
        `Run \`bun run screenshots\` (it builds first) or \`bunx vite build\` to refresh.`,
    );
  }
}
