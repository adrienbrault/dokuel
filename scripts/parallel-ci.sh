#!/usr/bin/env bash
# Run lint, typecheck, and test in parallel with clean output.
# Each task's output is captured; on failure, the full output is printed.

set -euo pipefail

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

run_task() {
  local name=$1; shift
  if "$@" > "$tmpdir/$name.out" 2>&1; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name"
    cat "$tmpdir/$name.out"
    return 1
  fi
}

run_task lint bun run lint &
P1=$!
run_task typecheck bun run typecheck &
P2=$!
run_task test bun run test &
P3=$!

FAIL=0
wait $P1 || FAIL=1
wait $P2 || FAIL=1
wait $P3 || FAIL=1

exit $FAIL
