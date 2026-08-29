# Verification

A version is complete when its spec passes against a real database seeded from `seed/*.json`.
Not when the code reads correctly.

```
tests/v0.spec.ts   Today view, block logging, MVD, streak
tests/v1.spec.ts   coverage grid, topic detail, notes
tests/v2.spec.ts   ladder scheduling, queue cap, blind recall, reschedule cap
tests/v3.spec.ts   practice batches, confidence, reason codes, disputed handling
tests/v4.spec.ts   mock entry, audit numbers, CA capture, PWA offline read
```

## Rules

- **Write the spec before the feature code.** The acceptance criteria in
  `prompts/later-versions.md` are the assertions; transcribe them.
- Seed a **dedicated test database** and reset it between runs. Never test against the
  database holding real study logs — losing those loses the streak, and the streak is
  load-bearing for a user whose failure mode is ignition.
- Test at **390px viewport** by default. Desktop is the secondary case here.
- Some criteria cannot be automated: whether a screen is comfortable one-handed at 05:30,
  whether the copy reads as steady rather than nagging. **Do not assert these.** List them
  under `needs_human_verification` in `state/build-state.json` and name them in the gate report.

## Seed fixtures worth asserting against

These are stable facts from `seed/*.json` and make good anchors:

- 11 subjects, 186 topics, 7 phases, 912 plan blocks
- 31 Aug 2026 has 3 blocks: `A` 05:30 (GEO, NCERT 11 Fundamentals Ch.1–3), `B` 19:00 (POL, Laxmikanth Ch.1), `C` 21:40 (revision)
- 5 Sep 2026 is a Saturday: 5 blocks, `SA SB SC SD SE`
- 6 Sep 2026 is a Sunday: 4 blocks, `U1 U2 U3 U4`
- Every Saturday from 3 Oct 2026 has `SC` = Sociology, 180 minutes
- All 28 `SOC-*` topics have `pyq_drills = false`
- MVD threshold is 160 minutes
