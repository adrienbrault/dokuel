# Second review implementation

Baseline: `d23592e`. User requested implementation of all eleven review
suggestions, coordinated with Luna agents at max reasoning effort.

## Acceptance ledger

Every item below remains open until its implementation and appropriate
verification are recorded. Passing a unit test alone does not establish
browser, network, device, or human usability behavior.

1. **Lifetime records:** retain lifetime games, best times, and streaks beyond
   bounded recent history; migrate existing storage safely. Verify more than
   100 same-bucket games and more than 60 consecutive dailies.
2. **Comparable results:** stable attempt identity, puzzle origin, first-attempt
   versus replay eligibility, imported challenge separation, and meaningful
   history UI. Repeated completion must not duplicate results.
3. **Clock and recovery:** elapsed time independent of callback frequency,
   explicit solo/live timing policies, accurate save/final checkpoints,
   finished-game proof and rematch-consent recovery, clear reconnect status.
4. **Friend loop:** return a comparison receipt, retain rivalry history, start
   another challenge, distinguish live invitations from time challenges, and
   support a best-of-three series without requiring accounts.
5. **Shared start and finish:** both players ready, shared countdown and puzzle
   reveal, understandable agreed rules, both results and second-finisher
   completion. Observe play sessions before deciding a quick-duel design.
6. **Learning:** progressive nudge, pattern, elimination, and reveal steps;
   explain intermediate deductions; offer a focused follow-up exercise and
   technique progress independent of speed.
7. **Accessibility:** one board tab stop, actual focus follows selection,
   logical navigation order and state announcements; verify keyboard, zoom,
   larger text, landscape, guide layout, and screen-reader behavior.
8. **Return later:** yesterday's unfinished daily entry, tested offline solo
   behavior, progress/record export and import, accurate saving feedback.
9. **Domain modules:** elapsed clock, durable result history, and versioned
   room recovery own their invariants. Preserve the separate solo and
   multiplayer presentation modules described in ADR-0001.
10. **Production-shaped validation:** separate-context signaling/WebRTC tests,
    forced relay coverage, interrupted connectivity, WebKit, physical iOS
    background/restore evidence where access is available; connection-stage
    diagnostics and TURN-issuance rate limits.
11. **Sharing previews and research:** usable challenge/comparison sharing
    previews and concrete research and demand experiments for quick duels,
    cosmetics, puzzle collections, and learning content. Product analytics,
    event collection, and the preferences panel were removed at user request.
    Real user feedback must be gathered rather than invented.

## Coordination

- Root owns integration, acceptance evidence, browser validation, and git.
- First wave: durable results, elapsed clock, room recovery in separate files.
- Root begins accessibility while the first wave runs.
- Follow-up waves cover social play, learning, offline recovery, operational
  testing after their domain dependencies stabilize.
- Each behavioral change follows a failing test, implementation, and relevant
  verification. Commits remain focused and use conventional messages.

## Evidence

Implementation and verification recorded during the review:

| Area | Evidence |
| --- | --- |
| Lifetime records and streaks | Tests exceed 100 games in one bucket and 60 consecutive dailies; atomic solo result envelope, replay provenance, and idempotency are covered. Multiplayer lifetime aggregates, migration, post-eviction winner corrections, and portable result backups are covered. |
| History | Source/assist buckets plus dated recent solves; browser source filtering passed on all four viewports. Saved friend comparisons can be reopened from Stats. |
| Clock/recovery | Injectable checkpoint clock, fractional saves, active solo timing, wall-clock live timing, versioned room snapshots, verified finishes and rematch consent; focused domain and binding tests passed. |
| Friend loop | Validated UTF-8 receipts, named comparison, rivalry storage and share actions. Fresh-target best-of-three setter/responder flow, reload, roles, and comparison links passed on all four viewports. Canonical whole-second times prevent contradictory tie labels. |
| Shared race | Both-ready rule agreement, three-second shared countdown, puzzle reveal gate, both finish proofs, and result comparison. Two-tab progression, consented rematch, and both-finisher browser assertions passed on all four viewports. |
| Learning | Four hint stages, standalone elimination, safe earlier deductions, and fresh-board exercises for all twelve logical techniques. Fixture/technique matching and pre-reveal leakage tests passed; browser practice passed on all four viewports and WebKit. |
| Accessibility | One tab stop, focus-following row navigation, status announcements, 200% root text in landscape, and bounded guide layout. Eight targeted Chromium checks and WebKit keyboard/text checks passed. Physical VoiceOver and browser zoom remain manual checks. |
| Return later | Dated daily resume passed on all four viewports. Real server-loss offline reload/new-puzzle behavior passed in Chromium viewports and WebKit. Download → preview → explicit restore passed on all four viewports. Save/result retry tests cover partial daily-streak failures, retained autosaves, and idempotent repair. |
| Architecture | Elapsed clock, result envelope, snapshot codec, identity-safe multiplayer autosave, and solo result/control components own their policies; separate SoloGame/MultiplayerBoard remain. See ADR-0002. |
| Network/operations | Real Worker signaling between separate storage contexts passed in Chromium. Forced native TURN relay and peer interruption/reload passed in Chromium and WebKit (2/2 after diagnostics). TURN issuance is origin-gated, rate-limited, and bounded by an upstream timeout. Connection-stage diagnostics stay local. |
| Research and sharing | Server-rendered share previews and a concrete observation/experiment protocol. No human results have been claimed. |

Browser commands use a fresh Vite production build. The review ran the complete
responsive screenshot suite (92/92) and new backup/practice/offline flows.
Images were inspected at `e2e/screenshots/backup-preview--iPhone-SE.png`,
`technique-practice--WebKit.png`, the shared
countdown, dated-daily, larger-text, and source-history screenshots. Backup
touch targets were increased to 44px after image review. Final friend comparison
and both-finisher result images were also inspected on iPhone SE.

Final local checks passed: 941 tests in 94 files; coverage 92.37% statements,
86.42% branches, 96.79% functions, and 94.67% lines. Lint has existing warning
diagnostics but no errors. App, build-tool, and Worker typechecks passed.
The documented frozen Bun install and production build both passed.
The final social browser suite passed 8/8 using Playwright's bundled Chromium.
A separate system-Chrome run stalled during shutdown; the desktop case also
passed independently before the bundled-runtime verification.

The actual local Pages server returned HTTP 200 with challenge-specific title,
canonical link, no-referrer and noindex metadata. The middleware is scoped to
challenge/receipt paths. Hosted messaging previews still need a deployed check.

## Explicit limits and deployment follow-up

- The provided Cloudflare log fails in automatic `npm install` before the app
  build. The documented Pages settings are `SKIP_DEPENDENCY_INSTALL=1`,
  `BUN_VERSION=1.3.14`, and build command
  `bun install --frozen-lockfile && bun run build`, output `dist`.
  Production and Preview settings have **not** been changed in Cloudflare;
  available Wrangler authentication had expired. A successful hosted retry has
  not been observed.
- Direct WebKit ICE exchanged host/reflexive candidates but did not establish a
  local route on this macOS runner, even with a longer discovery window and a
  local STUN service. CI uses direct Chromium plus forced-relay Chromium/WebKit.
  This does not establish direct WebKit behavior on a physical network.
- WebKit's `context.setOffline(true)` caused an internal navigation error.
  A dedicated server-stop test passed with the same service worker and is now
  the regression test; it verifies real network loss without that emulation API.
- A physical iPhone, VoiceOver session, real messaging client, and recruited
  human pairs were not available to the automated run. The exact protocol and
  remaining observations are in `docs/product-experiments.md`.
