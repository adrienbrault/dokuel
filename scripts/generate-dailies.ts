#!/usr/bin/env bun
/**
 * Freezes the daily challenge boards into `src/lib/dailies.json`.
 *
 * The daily is "the same puzzle for everyone, every day" only as long
 * as the generator, the clue bands, the grader, and the rng all stay
 * byte-identical forever. Any of those changing forks the daily
 * between differently-cached bundles. Baking the boards into a static
 * table cuts that dependency: the generator becomes a fallback for
 * dates outside the table, and everything inside it is fixed.
 *
 * Run with `bun run dailies:generate`. Entries for dates already in
 * the table are regenerated from the same generator, so re-running is
 * a no-op unless the generator has drifted - in which case the diff is
 * exactly the set of dailies that would have silently changed.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDailyPuzzle } from "../src/lib/daily.ts";

const OUT_PATH = join(import.meta.dirname, "..", "src", "lib", "dailies.json");

/** Inclusive ISO date range covered by the table. */
const FIRST_DATE = "2026-05-01";
const LAST_DATE = "2027-12-31";

const DAY_MS = 24 * 60 * 60 * 1000;

function* dateRange(first: string, last: string): Generator<string> {
  const end = Date.parse(`${last}T00:00:00Z`);
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= end; t += DAY_MS) {
    yield new Date(t).toISOString().slice(0, 10);
  }
}

function main(): void {
  const lines: string[] = [];
  let count = 0;
  for (const date of dateRange(FIRST_DATE, LAST_DATE)) {
    const { puzzle } = getDailyPuzzle(date, "medium");
    lines.push(`  ${JSON.stringify(date)}: ${JSON.stringify(puzzle)}`);
    count++;
  }
  writeFileSync(OUT_PATH, `{\n${lines.join(",\n")}\n}\n`);
  console.log(
    `Wrote ${count} dailies (${FIRST_DATE}..${LAST_DATE}) to ${OUT_PATH}`,
  );
}

main();
