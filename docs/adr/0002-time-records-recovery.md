# Time, result records, and recovery own their invariants

Status: accepted for the second-review implementation.

Timer callbacks repaint the UI; they do not measure duration. The elapsed-clock
module checkpoints an injected time source, preserving fractional time for saves
and projecting whole seconds for display. Solo pauses for explicit pause and
hidden tabs. Live play anchors to the room's shared wall-clock start, including
disconnected time. Local room liveness deadlines remain monotonic and are never
serialized as cross-device timestamps.

The solo result store atomically writes a versioned envelope containing recent
results, lifetime summaries, and recorded attempts. Evicting display history
cannot erase a PB or permit a duplicate completion. Origin and strongest assist
level define comparison buckets. Replays and imported puzzles do not earn a
fresh-generated PB. Failed durable writes keep the autosave and expose retry.
Recorded attempts grow with play; quota failures are surfaced and progress can
be exported rather than silently claiming success.

Room recovery uses a versioned, validated snapshot. Unknown versions and invalid
puzzle/solution proofs are rejected. A saved winner and both finish proofs,
readiness, shared start, and rematch consent survive restoration. Shared timing
is a casual peer-to-peer agreement, not a trusted anti-cheat service: clock skew
and a modified client remain outside the fairness guarantee.

Backups validate the entire replacement before applying it, then attempt rollback
on write failure. Browser localStorage does not provide a multi-key transaction;
the UI therefore reports failure without promising an infallible rollback. Live
room credentials and peer identity are excluded from portable progress.

The solo and multiplayer presentation modules remain separate, as required by
ADR-0001. Their timing, storage, and snapshot policies live in domain modules;
shared controls do not own the lifecycle of either game mode.
