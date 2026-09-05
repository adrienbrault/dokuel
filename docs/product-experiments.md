# Product experiments

These are proposed experiments, not findings. No interviews, willingness-to-pay
results or physical iPhone observations have been collected by this
implementation.

## Observe five pairs and three solo learners

Recruit through an explicit invitation by the maintainer; no automated outreach
is sent. Include a new Sudoku player, an experienced solver, an iPhone user, and
someone using keyboard or a screen reader. Ask for recording consent separately.

For each pair: send an asynchronous challenge using their normal messaging app;
let the recipient start later; ask them to return the result; ask the first
player what happened and how to play again. Then try a live invite with different
networks, one background/restore, and a full best-of-three. Avoid instruction
until they ask. Record where they hesitate, whether assistance rules are clear,
who thinks won, and whether either wants another game unprompted.

For learners: ask them to explain a highlighted deduction before revealing it,
then solve the focused exercise on the new board. Record explanation accuracy
and whether the exercise transfers to a later puzzle, independently of speed.

Use one row per observation: device/browser, task, expected action, actual
action, help required, completion, direct quote (with consent), follow-up.
Do not record room codes, full share URLs, or participant names in the repo.

## Small demand experiments

Explore these ideas through conversations and prototypes. Record preferences
with participant consent, and do not represent an unavailable item as purchasable.

| Idea | Smallest next experiment | Decision evidence |
| --- | --- | --- |
| Short duels | Let five pairs try a separate 3–5 minute puzzle session beside a full duel. | Prefer it only if pairs finish more often and voluntarily choose another round; record whether shorter play weakens the Sudoku experience. |
| Board themes | Show three accessible theme mockups with the same contrast and targets. Ask people to choose at an explicit proposed price. | Proceed to a real offer only after several independent players request the same theme and accept its displayed price. |
| Puzzle collections | Offer a clearly described ten-puzzle themed sample with progress tracking. | Check return visits and completion over a week, then ask whether the remaining collection is worth the proposed price. |
| Guided lessons | Run three lessons based on techniques players actually missed. | Measure solving an unseen exercise without help and voluntary return to the next lesson before producing a large curriculum. |

Write hypotheses and success criteria before recruitment, retain negative
observations, and review after two weeks. These small samples guide iteration;
they do not establish statistical significance. Keep free play usable while
testing optional purchases. No checkout, subscription, or outreach ships here.

## Release/device checklist

- Real iPhone Safari and installed web app: background for 20 seconds, lock the
  device, return, reload, and verify the same board and intended elapsed time.
- VoiceOver: enter the board once, navigate rows/columns, hear given/value/notes/
  conflict states, request each hint stage, leave the board, and close the result.
- Safari browser zoom and iOS larger text: check portrait/landscape, focus rings,
  settings, practice board, backup preview, and receipt at 200%.
- Messaging previews: paste both challenge and receipt URLs into the actual
  messaging clients used by the recruited pairs after Pages deployment.

Automated WebKit and font-size checks complement these observations; they do
not substitute for a physical device, assistive technology, or real people.
