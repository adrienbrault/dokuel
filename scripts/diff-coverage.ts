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
 *   --base=<ref>   Git ref to diff against (default: HEAD)
 *   --staged       Only check staged changes
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const COVERAGE_DIR = join(ROOT, "coverage-diff");

type CoverageEntry = {
  statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
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

function getChangedLines(file: string, base: string, staged: boolean): Set<number> {
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
    if (match) {
      const start = Number.parseInt(match[1], 10);
      const count = match[2] !== undefined ? Number.parseInt(match[2], 10) : 1;
      for (let i = start; i < start + count; i++) {
        lines.add(i);
      }
    }
  }
  return lines;
}

function getChangedFiles(base: string, staged: boolean): string[] {
  const diffFlag = staged ? "--cached" : "";
  const cmd = `git diff ${diffFlag} ${base} --name-only --diff-filter=ACMR`;
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .filter((f) => /^src\/(lib|hooks)\/.*\.tsx?$/.test(f))
      .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
  } catch {
    return [];
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

function runCoverageForFiles(testFiles: string[]): void {
  if (testFiles.length === 0) return;
  const fileArgs = testFiles.map((f) => `"${f}"`).join(" ");
  try {
    execSync(
      `bunx vitest run --coverage --coverage.reporter=json --coverage.reportsDirectory="${COVERAGE_DIR}" ${fileArgs}`,
      { cwd: ROOT, encoding: "utf-8", stdio: "pipe" },
    );
  } catch {
    // Tests may fail but coverage is still generated
  }
}

type UncoveredLine = {
  line: number;
  type: "statement" | "branch" | "function";
  detail?: string;
};

function findUncoveredChangedLines(
  filePath: string,
  changedLines: Set<number>,
  coverage: CoverageEntry,
): UncoveredLine[] {
  const uncovered: UncoveredLine[] = [];
  const seenLines = new Set<number>();

  // Check statements
  for (const [id, loc] of Object.entries(coverage.statementMap)) {
    if (coverage.s[id] > 0) continue;
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
      if (hits[i] > 0) continue;
      const loc = branch.locations[i];
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
    if (coverage.f[id] > 0) continue;
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
const base = args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "HEAD";
const staged = args.includes("--staged");
const fileArg = args.find((a) => !a.startsWith("--"));

// Determine files to check
let filesToCheck: string[];
if (fileArg) {
  const rel = relative(ROOT, resolve(fileArg));
  filesToCheck = [rel];
} else {
  filesToCheck = getChangedFiles(base, staged);
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
runCoverageForFiles(testFiles);

// Read coverage data
const coveragePath = join(COVERAGE_DIR, "coverage-final.json");
if (!existsSync(coveragePath)) {
  console.error("Coverage data not generated. Check test output above.");
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
  const changedLines = getChangedLines(file, base, staged);
  if (changedLines.size === 0) continue;

  // Find coverage entry (key might be absolute path)
  const entry = coverageData[absPath] ?? coverageData[file];
  if (!entry) continue;

  const uncovered = findUncoveredChangedLines(file, changedLines, entry);
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
