/**
 * Diff Coverage Checker
 *
 * Cross-references git-changed lines with vitest coverage data
 * to surface untested code paths in your changes.
 *
 * Usage:
 *   bun scripts/diff-coverage.ts [file]       # Check specific file
 *   bun scripts/diff-coverage.ts               # Check all changed files
 *
 * Options:
 *   --base=<ref>   Git ref to diff against (default: merge-base with
 *                  origin/main, falling back to HEAD outside a branch)
 *   --staged       Only check staged changes
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const COVERAGE_DIR = join(ROOT, "coverage-diff");

type CoverageEntry = {
  statementMap: Record<
    string,
    { start: { line: number }; end: { line: number } }
  >;
  s: Record<string, number>;
  branchMap: Record<
    string,
    { locations: Array<{ start: { line: number }; end: { line: number } }> }
  >;
  b: Record<string, number[]>;
  fnMap: Record<
    string,
    { name: string; loc: { start: { line: number }; end: { line: number } } }
  >;
  f: Record<string, number>;
};

function getChangedLines(
  file: string,
  base: string,
  staged: boolean,
): Set<number> {
  const diffFlag = staged ? "--cached" : "";
  const cmd = `git diff ${diffFlag} ${base} -U0 -- "${file}"`;
  let output: string;
  try {
    output = execSync(cmd, { cwd: ROOT, encoding: "utf-8" });
  } catch {
    return new Set();
  }

  const lines = new Set<number>();
  for (const line of output.split("\n")) {
    // Parse @@ -a,b +c,d @@ hunks
    const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (match?.[1]) {
      const start = Number.parseInt(match[1], 10);
      const count = match[2] !== undefined ? Number.parseInt(match[2], 10) : 1;
      for (let i = start; i < start + count; i++) {
        lines.add(i);
      }
    }
  }
  return lines;
}

function inCoverageScope(f: string): boolean {
  return (
    /^src\/(lib|hooks)\/.*\.tsx?$/.test(f) &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".test.tsx")
  );
}

function getChangedFiles(base: string, staged: boolean): string[] {
  const diffFlag = staged ? "--cached" : "";
  const cmd = `git diff ${diffFlag} ${base} --name-only --diff-filter=ACMR`;
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
    if (!output) return [];
    return output.split("\n").filter(inCoverageScope);
  } catch {
    return [];
  }
}

/** Brand-new files that are not committed yet — `git diff <ref>` never
 *  lists them, so without this a freshly written module escaped the
 *  check entirely. */
function getUntrackedFiles(): string[] {
  try {
    const output = execSync("git ls-files --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();
    if (!output) return [];
    return output.split("\n").filter(inCoverageScope);
  } catch {
    return [];
  }
}

/** Default diff base: the branch point against origin/main. Diffing
 *  against plain HEAD only sees uncommitted edits, which in a
 *  commit-as-you-go workflow is almost always an empty set — the tool
 *  then reported "no changes" while the branch carried days of work. */
function defaultBase(): string {
  try {
    return execSync("git merge-base HEAD origin/main", {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "HEAD";
  }
}

function findTestFile(file: string): string | null {
  const base = file.replace(/\.tsx?$/, "");
  for (const ext of [".test.ts", ".test.tsx"]) {
    const testPath = join(ROOT, base + ext);
    if (existsSync(testPath)) return testPath;
  }
  return null;
}

function runCoverageForFiles(testFiles: string[]): string | null {
  if (testFiles.length === 0) return null;
  const fileArgs = testFiles.map((f) => `"${f}"`).join(" ");
  try {
    execSync(
      `bunx vitest run --coverage --coverage.reporter=json --coverage.reportsDirectory="${COVERAGE_DIR}" ${fileArgs}`,
      { cwd: ROOT, encoding: "utf-8", stdio: "pipe" },
    );
    return null;
  } catch (err) {
    // vitest exits non-zero for failing tests, which still write
    // coverage. Keep the output: if coverage turns out to be missing,
    // a real crash happened and its cause must be shown, not swallowed.
    const e = err as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
  }
}

type UncoveredLine = {
  line: number;
  type: "statement" | "branch" | "function";
  detail?: string;
};

function findUncoveredChangedLines(
  changedLines: Set<number>,
  coverage: CoverageEntry,
): UncoveredLine[] {
  const uncovered: UncoveredLine[] = [];
  const seenLines = new Set<number>();

  // Check statements
  for (const [id, loc] of Object.entries(coverage.statementMap)) {
    if ((coverage.s[id] ?? 0) > 0) continue;
    for (let line = loc.start.line; line <= loc.end.line; line++) {
      if (changedLines.has(line) && !seenLines.has(line)) {
        seenLines.add(line);
        uncovered.push({ line, type: "statement" });
      }
    }
  }

  // Check branches
  for (const [id, branch] of Object.entries(coverage.branchMap)) {
    const hits = coverage.b[id];
    for (let i = 0; i < branch.locations.length; i++) {
      if ((hits?.[i] ?? 0) > 0) continue;
      const loc = branch.locations[i];
      if (!loc) continue;
      for (let line = loc.start.line; line <= loc.end.line; line++) {
        if (changedLines.has(line) && !seenLines.has(line)) {
          seenLines.add(line);
          uncovered.push({ line, type: "branch" });
        }
      }
    }
  }

  // Check functions
  for (const [id, fn] of Object.entries(coverage.fnMap)) {
    if ((coverage.f[id] ?? 0) > 0) continue;
    const loc = fn.loc;
    for (let line = loc.start.line; line <= loc.end.line; line++) {
      if (changedLines.has(line) && !seenLines.has(line)) {
        seenLines.add(line);
        uncovered.push({ line, type: "function", detail: fn.name });
      }
    }
  }

  return uncovered.sort((a, b) => a.line - b.line);
}

// --- Main ---

const args = process.argv.slice(2);
const base =
  args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? defaultBase();
const staged = args.includes("--staged");
const fileArg = args.find((a) => !a.startsWith("--"));

// Determine files to check. Untracked files have no diff against any
// ref — every line in them counts as changed.
const untracked = new Set(getUntrackedFiles());
let filesToCheck: string[];
if (fileArg) {
  const rel = relative(ROOT, resolve(fileArg));
  filesToCheck = [rel];
} else {
  filesToCheck = [...new Set([...getChangedFiles(base, staged), ...untracked])];
}

if (filesToCheck.length === 0) {
  console.log("No changed source files to check coverage for.");
  process.exit(0);
}

// Find test files
const testFiles: string[] = [];
const filesWithTests: string[] = [];
for (const file of filesToCheck) {
  const testFile = findTestFile(file);
  if (testFile) {
    testFiles.push(testFile);
    filesWithTests.push(file);
  }
}

if (testFiles.length === 0) {
  console.log("No test files found for changed files.");
  process.exit(0);
}

// Run coverage
console.log(`Running coverage for ${testFiles.length} test file(s)...`);
const failureOutput = runCoverageForFiles(testFiles);

// Read coverage data
const coveragePath = join(COVERAGE_DIR, "coverage-final.json");
if (!existsSync(coveragePath)) {
  console.error("Coverage data not generated — vitest crashed:");
  if (failureOutput) {
    console.error(failureOutput.trim().split("\n").slice(-30).join("\n"));
  }
  process.exit(1);
}

const coverageData: Record<string, CoverageEntry> = JSON.parse(
  readFileSync(coveragePath, "utf-8"),
);

// Analyze each file
let totalUncovered = 0;
let totalChanged = 0;

for (const file of filesWithTests) {
  const absPath = join(ROOT, file);
  const changedLines = untracked.has(file)
    ? new Set(
        Array.from(
          { length: readFileSync(absPath, "utf-8").split("\n").length },
          (_, i) => i + 1,
        ),
      )
    : getChangedLines(file, base, staged);
  if (changedLines.size === 0) continue;

  // Find coverage entry (key might be absolute path)
  const entry = coverageData[absPath] ?? coverageData[file];
  if (!entry) continue;

  const uncovered = findUncoveredChangedLines(changedLines, entry);
  totalChanged += changedLines.size;
  totalUncovered += uncovered.length;

  if (uncovered.length > 0) {
    console.log(`\n⚠ ${file} — ${uncovered.length} uncovered changed line(s):`);
    for (const u of uncovered) {
      const detail = u.detail ? ` (${u.detail})` : "";
      console.log(`  L${u.line}: ${u.type}${detail}`);
    }
  }
}

// Cleanup
rmSync(COVERAGE_DIR, { recursive: true, force: true });

// Summary
if (totalChanged === 0) {
  console.log("\nNo changed lines in coverage scope.");
} else {
  const covered = totalChanged - totalUncovered;
  const pct = Math.round((covered / totalChanged) * 100);
  console.log(
    `\nDiff coverage: ${covered}/${totalChanged} changed lines covered (${pct}%)`,
  );

  if (totalUncovered > 0) {
    console.log(
      "Review the uncovered lines above and add tests for any important code paths.",
    );
  }
}
