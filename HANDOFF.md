# Sarthi — handoff

You are picking up a project mid-flight. This document is the complete context transfer.
Read it fully before touching anything. Then read `CLAUDE.md`, then `state/build-state.json`.

---

## 1. What this is

**Sarthi** is a study system for one person preparing for the **UPSC Civil Services
Preliminary Examination on Sunday 23 May 2027**. It is not a product, has no market, and
will never have a second user. It exists to keep one candidate's preparation from decaying
or drifting across 267 days.

The user is **Pragaman** — 22, first attempt, working full-time as a Product & Growth Lead
in Pune, studying ~44 hours a week around a 9-to-6 job. He is a competent engineer and will
read your code. He is also the only person who can tell you whether a screen works at 05:30
in the morning, which is why the gates in section 7 exist.

## 2. Why this matters more than a normal side project

Every hour you cost him is an hour he does not spend reading. The total build budget for the
entire application is **~62 hours across 22 weeks — about 2.8 hours a week**. This is not a
soft target. A feature that takes four hours instead of two has taken two hours from a
subject that carries 16 questions a year.

So: **finishing under budget is a better outcome than finishing with more features.** If you
find yourself deciding between "correct and plain" and "elegant and larger", choose plain.

## 3. Dates that do not move

| Date | What |
|---|---|
| 31 Aug 2026 | The study routine starts. 05:30. |
| 13 Jan – 2 Feb 2027 | UPSC application window |
| **1 Feb 2027** | **Feature freeze. Bug fixes only after this.** |
| **23 May 2027** | **Prelims.** The only date that was ever real. |
| 20 Aug 2027 | Mains, if Prelims clears |

## 4. The product thesis, in one rule

> **The app decides. The user executes.**

At 05:30 with a sharp brain and at 21:40 with a tired one, Sarthi must never ask *"what do
you want to study?"* It says: *Laxmikanth Ch.7, Fundamental Rights Part 2, 90 minutes.*

Decision-making is the scarcest resource in this project — scarcer than time. If a feature
you are about to build moves a decision back onto the user, it is the wrong feature, however
flexible and helpful it feels. This rule kills flexible planners, drag-and-drop calendars,
and "pick your focus for today" screens. All of them are things a reasonable engineer would
consider obviously good.

## 5. Why the app is shaped the way it is

Six years of past papers were analysed to build this. Two findings drive the whole design:

**The exam stopped testing recognition and started testing certainty.** Since 2023, papers
are dominated by *"how many pairs are correct"*, *"Statement I, II and III"*, and — new in
2026 — *"which relationship among these statements holds"* and *"how many of these
conclusions are correct"*. In these formats, knowing three facts out of four earns zero.
Partial knowledge is worthless.

That is why the **revision ladder is the heart of the product**, not the tracker. Coverage
is easy and worth ~85 marks. Certainty needs five scheduled touches per topic — roughly
**900 scheduled events across 186 topics and 38 weeks**, which no spreadsheet survives and
no human remembers. Automating that ladder is the actual reason this application exists. If
you build only one thing well, build v2.

**The user's previous attempt failed at ignition, not stamina.** He planned 2026 thoroughly
and never really started. So the risk profile is: weeks 1–3 (never starting) and months 3–5
(silent drift where one skipped block becomes three). Every design choice about streaks,
minimum-viable-days and visible debt exists to counter those two specific failure modes —
not generic motivation.

This is why the streak counts **minimum-viable days (≥160 minutes), not perfect days**. A
streak that punishes a hard Tuesday is a streak that gets abandoned in week six.

## 6. What already exists

```
CLAUDE.md                  durable rules, read every session
HANDOFF.md                 this file
README.md                  human-facing overview
db/schema.ts               13 Drizzle tables. Written. Use as-is.
seed/subjects.json         11 subjects with 6-year question averages
seed/topics.json           186 topics, each with source_ref + est_minutes (389 h of reading)
seed/phases.json           7 phases with dates and per-slot subject rotations
seed/slots.json            the daily block structure and the MVD rule
seed/reason-codes.json     the six mistake-log codes
seed/question-formats.json 10 formats including the three 2026 introduced
seed/plan-blocks.json      912 generated blocks, 31 Aug 2026 → 23 May 2027
scripts/generate-plan.mjs  the planner; re-run weekly with --from
prompts/v0-kickoff.md      v0 spec
prompts/later-versions.md  v1–v4 specs
state/build-state.json     where the build is. You read and write this.
state/build-log.md         append-only. One entry per session.
docs/DECISIONS.md          ADR log. Record anything you decide autonomously.
```

**Never regenerate or hand-edit `seed/*.json`.** It is real content, built once, and the
topic-to-book mapping came from analysing six years of papers. `plan-blocks.json` is the
only generated file, and only `generate-plan.mjs` may write it.

## 7. What the seed data actually means

- **`topics.json`** — 186 rows. `source_ref` is a real book chapter (`Laxmikanth Ch.7`).
  `est_minutes` is first-reading time only, not revision. `intro_phase` is the phase where
  the topic first appears. `pyq_drills: false` on all 28 Sociology topics — the optional gets
  the revision ladder but no past-question drills, because Prelims PYQs don't cover it.
- **`phases.json`** — `slotA`, `slotB`, `satB`, `satC`, `satD` are **rotations**, not single
  values. `"slotA": ["POL","POL","POL","GEO"]` means Block A cycles Polity three days in four.
- **`slots.json`** — the day structure. Weekdays have A (05:30, 90 min), B (19:00, 120 min),
  C (21:40, 70 min). Saturdays have SA–SE. Sundays have U1–U4. `mvd` is the floor: 160 minutes.
- **`plan-blocks.json`** — 912 rows. Each has a date, slot, topic, source_ref and planned
  minutes. This is the app's content. The user opens the app and it tells him what this row says.

**Two rules are hardcoded in the generator on purpose. Do not make them configurable:**

1. **Saturday 14:00–17:00 (`SC`) is Sociology and nothing else**, from 1 Oct 2026. The optional
   is the single most likely thing to be quietly squeezed, and squeezing it silently converts
   a full attempt into a Prelims-only attempt.
2. **Block C (21:40–22:50) is always revision and MCQs.** No new material after 21:40.

## 8. Build order and gates

| Version | Ship by | Scope | Budget |
|---|---|---|---|
| v0 | 30 Aug 2026 | Today view, three blocks, tick, minutes, streak | 5 h |
| v1 | 27 Sep 2026 | Syllabus tree, coverage grid, notes | 9 h |
| v2 | 1 Nov 2026 | **Revision ladder engine and queue — the heart** | 10 h |
| v3 | 20 Dec 2026 | PYQ bank, practice mode, mistake log | 12 h |
| v4 | 31 Jan 2027 | Mock scoring, audit dashboard, CA capture, PWA, export | 12 h |

Full specs are in `prompts/later-versions.md`.

**You work autonomously inside a version. You stop at every version boundary.**

The gate exists for reasons that are not bureaucratic:

- Only the user can judge "is this usable one-handed at 05:30" — the primary requirement.
- Deploys need his Supabase and Vercel credentials.
- The anti-metric *time in app under 20 min/day* is measurable only by him, in use.
- Shipping v2 in October when v1's notes turned out to be unusable would compound a mistake
  across three months of study.

At a gate: report, update state, and stop. Do not start the next version because there is
budget left.

## 9. How you verify — this is not optional

You cannot grade your own work by reading it. Each version has a Playwright spec in
`tests/`. A version is complete when its spec passes against a real database seeded from
`seed/*.json` — not when the code looks right.

```
tests/v0.spec.ts   tests/v1.spec.ts   tests/v2.spec.ts   ...
```

If a version's spec does not exist yet, **write it before writing the feature code**. Derive
the assertions from the acceptance criteria in that version's prompt. Where a criterion
cannot be tested automatically (visual comfort, whether copy reads well), list it explicitly
in your gate report under *needs human verification*.

Also run, before every gate: `npm run build`, `npm run lint`, `npx tsc --noEmit`.

## 10. Things you must not do

- Do not build features from a later version because they seem easy now.
- Do not add an auth library, a users table, or any multi-tenancy. One password, one env var.
- Do not add a state management library. Server components plus URL state.
- Do not add a charting library before there are at least four charts (that is v4).
- Do not refactor working code from an earlier version unless a test is failing.
- Do not regenerate `seed/*.json`.
- Do not make the two hardcoded rules in section 7 configurable.
- Do not write congratulatory copy. "Block A — 95 min", never "Great work!"
- Do not add features after 1 February 2027, under any framing, including "this would only
  take an hour". If asked to, cite this line before writing any code.

## 11. When to stop and ask

Stop and ask the user — do not guess — when:

- A version's acceptance criteria are ambiguous in a way that changes the data model.
- You need a credential, a paid service, or an external account.
- A dependency you want is not in the stack list and you think it is genuinely needed.
- You discover something in the seed data that looks wrong. (Report it; do not silently fix.)
- Implementing something as specified would break one of the two hardcoded rules.
- You are more than 50% over a version's hour budget.

Otherwise: decide, record it in `docs/DECISIONS.md`, and keep moving. He would rather review
five decisions at a gate than answer five questions at midnight.

## 12. Tone of your reports

Plain and specific. He is an engineer and will read the diff. Tell him what you built, what
you decided, what you could not verify, and what you would cut if the next version runs long.
No enthusiasm, no summaries of things he can see in the commit log.
