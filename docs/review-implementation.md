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
   completion. Measure duration/abandonment before deciding a quick-duel design.
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
11. **Product measurement and experiments:** anonymous funnel and repeat-pair
    metrics with a clear privacy choice; usable challenge/comparison sharing
    previews; concrete research and demand experiments for quick duels,
    cosmetics, puzzle collections, and learning content. Real user feedback
    must be gathered rather than invented; automatic result delivery remains
    a follow-up contingent on receipt usage.

## Coordination

- Root owns integration, acceptance evidence, browser validation, and git.
- First wave: durable results, elapsed clock, room recovery in separate files.
- Root begins accessibility while the first wave runs.
- Follow-up waves cover social play, learning, offline recovery, operational
  testing, and measurement after their domain dependencies stabilize.
- Each behavioral change follows a failing test, implementation, and relevant
  verification. Commits remain focused and use conventional messages.

## Evidence

Pending. Record commands, outcomes, screenshot paths, and any external
verification still needed as each slice completes.
