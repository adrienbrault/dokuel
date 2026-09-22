#!/bin/bash
# Installs dependencies in Claude Code on the web sessions, so the Stop
# hook's `bun run ci` finds biome, tsc and vitest in a fresh container.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
bun install
