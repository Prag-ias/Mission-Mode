# Kickoff prompts for v1 – v4

Each one starts the same way. Paste the header, then the version's body.

> Read `CLAUDE.md` first, then `db/schema.ts` and `seed/*.json`.
> Stay inside this version's scope — the build order and freeze date in `CLAUDE.md` are binding.
> Stop when the acceptance criteria pass and tell me. Do not start the next version.

---

## v1 — Syllabus tree, coverage, notes · ship by 27 Sep 2026 · 9 hours

Build the syllabus layer. Three things:

**Coverage grid (`/syllabus`)** — all 186 topics as a dense colour-coded grid, grouped by subject, one cell per topic. The cell's colour encodes `stage` (`unread → reading → read → R1 → R2 → R3 → R4`). Tapping a cell opens the topic. This screen exists to answer one question at a glance: *what have I not touched?*

**Topic detail (`/topic/[code]`)** — name, source ref, estimated minutes, current stage, a stage control, and the note.

**Notes** — one markdown note per topic. Autosave, no save button. Must be editable on a phone. Full-text search across all notes from the syllabus screen.

Also: the Today screen's blocks now link to their topic.

Acceptance: every one of the 186 topics is reachable in two taps from `/`; a note written on the phone appears on the laptop; the coverage grid renders in under a second.

---

## v2 — The revision ladder · ship by 1 Nov 2026 · 10 hours

This is the heart of the product. Everything before it was scaffolding.

**The engine.** When a topic's stage becomes `read`, insert four `revision_events` at D+1, D+7, D+30 and D+90. Completing an event advances the topic's stage. Phase 3–5 whole-syllabus passes (`PASS2`, `PASS3`, `PASS4`) are seeded separately from `phases.json` date ranges.

**The queue (`/revise`)** — everything due today, most overdue first, capped at **12 items**. Anything beyond 12 becomes *revision debt*, shown as a single number. The cap is deliberate: an unusable 60-item list is worse than a visible debt figure.

**Blind recall for D+1** — the note is hidden, a free-text box takes what I remember, submitting reveals the note, and I self-rate 1–3 into `recall_score`. A score of 1 shortens the next interval.

**Missed-block rescheduling** — per decision D4: auto-reschedule up to twice (`reschedule_count`), then the block becomes a visible debt item I clear by hand. Drift must stay visible.

Block C on the Today screen now opens straight into the queue.

Acceptance: marking a topic read creates exactly four events; the queue never exceeds 12; debt is visible on the Today footer; rescheduling stops at two.

---

## v3 — PYQ bank, practice, mistake log · ship by 20 Dec 2026 · 12 hours

The bank is ingested separately (see the pipeline in `README.md`) — this version is the app around it.

**Practice mode (`/practice`)** — batches of 10–20 questions, filterable by subject, topic, year, question format, or *previously wrong*. One question per screen, big tap targets, keyboard shortcuts on desktop.

**Confidence before reveal** — sure / unsure / guess, recorded on every attempt. "Correct but guessed" must be reportable separately from raw accuracy; it is the number that tells me whether I actually know something.

**Mistake log** — every wrong answer requires one of the six reason codes from `seed/reason-codes.json` before the next question appears. No skipping.

**Feedback into the ladder** — a wrong answer coded `knew_forgot` (code 2) shortens that topic's next revision interval.

**Disputed answers** — per decision D1, questions with `disputed = true` show a badge, are still practised, and are excluded from accuracy stats.

Acceptance: a 20-question batch completes to a summary, not a dead end; no wrong answer can be left uncoded; the format filter can isolate the three formats 2026 introduced (`relationship`, `conclusion_count`, `case_study`).

---

## v4 — Analytics, current affairs, PWA · ship by 31 Jan 2027 · 12 hours

**Mock entry (`/tests/new`)** — enter 100 answers in under four minutes. Auto-score, per-subject accuracy, attempted count. Subjects below 60% push their three weakest topics into the revision queue within seven days.

**Audit view (`/audit`)** — one screen, the only place density is allowed: block adherence %, hours by subject against the plan, coverage counts, revision debt, the rolling three-mock average plotted against the 120 target and the 92.66 cut-off, and the reason-code mix.

**Current affairs capture** — under twenty seconds per item on a phone: headline, one line, topic tags. Tagged items surface inside that topic's revision screen. A Sunday prompt for the bio-geo-tech drill (*what is the science, where on the map, which ecosystem*).

**Decay meter** — a 0–100 freshness figure per subject from days-since-last-touch weighted by ladder stage.

**PWA** — installable, with a service-worker read cache for notes, today's plan and the revision queue. Writes queue and flush on reconnect. Nothing more; true offline sync is out of scope per NG4.

**Export** — one button, all data as JSON. Insurance against my own database.

Acceptance: a mock entered in under four minutes; the audit screen answers "am I on track" without scrolling; the app opens from the home screen with no network and still shows today's plan.

---

## After 1 February 2027

Feature freeze. Bug fixes only.

If I ask you to add a feature after that date, remind me of this line before writing any code.
