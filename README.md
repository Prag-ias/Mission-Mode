# Sarthi

A study system for one candidate, one exam, one date: **UPSC CSE Prelims, 23 May 2027**.

Its whole job is to make sure nothing learned decays and nothing planned slips. It is
closer to a training programme than a productivity tool.

> **The one rule: the app decides, you execute.**
> At 05:30 with a sharp brain and at 21:40 with a tired one, Sarthi must never ask
> *"what do you want to study?"* Every screen that asks you to choose spends energy
> you need for the book.

---

## Decisions already made — do not relitigate mid-build

| | Decision |
|---|---|
| **Optional** | Sociology. Locked 29 Aug 2026. |
| **IFoS** | Parked for a later attempt. Its Mains needs two science optionals. |
| **Answer keys** | Official UPSC key where it exists; **one named** coaching fallback otherwise; anything the sources disagree on gets `disputed = true` and a visible badge, and is excluded from accuracy stats. |
| **Explanations** | Generated **upfront**, in the same pass as ingestion. Works offline; no runtime latency; no hallucinated answers during revision. |
| **Sociology in Sarthi** | Yes — a normal subject with the revision ladder **on** and PYQ drills **off** (`topics.pyq_drills = false`). |
| **Missed blocks** | Auto-reschedule **at most twice** (`reschedule_count`). The third time it becomes a visible debt item that must be cleared by hand. Drift must stay visible. |
| **Notifications** | Deferred. Revisit after two weeks of the routine. |
| **Plan storage** | Seeded **upfront** for all 267 days, then re-planned weekly with `--from`. |
| **Stack** | Next.js + TypeScript on Vercel · Postgres on Supabase · Drizzle ORM · Tailwind + shadcn/ui · git. |
| **Feature freeze** | **1 February 2027.** Bug fixes only after that date. Non-negotiable. |

---

## What is in here

```
seed/
  subjects.json          11 subjects with 6-year question averages
  topics.json            186 topics, each with source_ref and est_minutes  (389 h of first reading)
  phases.json            7 phases with dates and per-slot subject rotations
  slots.json             the daily block structure and the minimum-viable-day rule
  reason-codes.json      the six mistake-log codes
  question-formats.json  10 formats, including the three 2026 introduced
  plan-blocks.json       generated — 912 blocks to Prelims, 1,532 planned hours
db/
  schema.ts              Drizzle schema, 13 tables
scripts/
  generate-plan.mjs      the planner
```

## Generating the plan

```bash
node scripts/generate-plan.mjs                 # full seed, writes seed/plan-blocks.json
node scripts/generate-plan.mjs --mains          # include Phase 6 (24 May – 20 Aug 2027)

# weekly re-plan — history before --from is never touched
node scripts/generate-plan.mjs --from 2026-11-02 --existing seed/plan-blocks.json
```

It prints hours by subject and, more usefully, **warns about any topic that would not
get its full first reading before 23 May**. Treat that warning as the real output — if a
subject appears there, change its rotation in `phases.json` and re-run.

### Tuning the subject mix

`phases.json` rotates subjects through slots. `"slotA": ["POL","POL","POL","GEO"]` means
Block A cycles Polity three days out of four. To give a starved subject more time, add it
to a rotation; to cool one down, remove an entry. Re-run and read the by-subject hours.

Two rules the generator enforces and you should not change:

- **Saturday 14:00–17:00 (`SC`) is Sociology** from 1 October, and only Sociology. It is
  the single most likely thing to be quietly squeezed, which is why it is hardcoded.
- **Block C (21:40–22:50) is always revision and MCQs.** No new material after 21:40.

### Current shape

```
912 blocks · 1,532 planned hours · ≈1,302 effective at 85% adherence
SOC 131 h · CAI 129 h · GEO 112 h · POL 107 h · ECO 64 h · HIS 43 h
SNT 41 h · ENV 38 h · CSAT 27 h · ART 22 h · ANM 22 h
```

Note the ratio: 389 hours of first reading against ~1,150 hours of revision, drills, tests
and current affairs. That is deliberate. The 2023–2026 papers test **certainty**, not
recognition, and certainty is bought with repetition rather than coverage.

---

## Build order

| Version | Ship by | Contents | Budget |
|---|---|---|---|
| v0 | Sun 30 Aug 2026 | Today view, three blocks, tick, minutes, streak | 5 h |
| v1 | 27 Sep | Syllabus tree, coverage grid, notes | 9 h |
| v2 | 1 Nov | Revision ladder engine and queue — the heart of it | 10 h |
| v3 | 20 Dec | PYQ bank, practice mode, mistake log | 12 h |
| v4 | 31 Jan | Mock scoring, audit dashboard, CA capture, PWA, export | 12 h |
| — | **1 Feb** | **Feature freeze.** Bug fixes only. | — |

About 2.8 hours a week. It comes out of Saturday evening or Sunday flex —
**never out of Block A and never out of the Sociology slot.** If build hours exceed 4 in
any week, cut scope that week.

---

## PYQ ingestion

Proven on the 2026 paper. The papers are bilingual scans with no text layer: odd pages
are English, even pages Hindi.

```bash
SRC="GS PAPER 1 2026.pdf"
qpdf --empty --pages "$SRC" $(seq -s, 3 2 55) -- odd.pdf     # instant, no rasterising
pdftoppm -r 200 -png odd.pdf out/p                            # 200 dpi is the sweet spot
ls out/*.png | xargs -P 4 -I{} sh -c 'tesseract "$1" "${1%.png}" -l eng --psm 6' _ {}
cat out/*.txt > gs1_2026.txt
```

Then: feed ~15 questions at a time to Claude for JSON matching the `questions` schema →
attach answer keys with provenance → **30 minutes of human review per paper, non-negotiable**
→ generate explanations in batches of 20.

About 2–2.5 hours per paper. **Do the six GS Paper 1 papers only** — one per fortnight
across Phase 1, finished by early December so the bank is live before Phase 3 needs it.
CSAT ingestion is P2 and probably never happens: CSAT rewards timed practice on paper,
not topic tagging.

---

## The metrics that matter

Leading, weekly: block adherence ≥85% · MVD streak unbroken · revision debt <15 ·
Sociology ≥7 h · logging latency <10 min.

Lagging, monthly: rolling 3-mock average against the 120 line · topics at R2 or better ·
mistake code 03 (misread) below 15% · "correct but guessed" falling.

Anti-metrics: **time in app excluding practice under 20 min/day** — above that, Sarthi is
stealing study time and features should be *removed*. **Build hours ≤4/week.** After
November, days since last commit going up is a good sign.

The only number that finally matters is the GS Paper 1 score on 23 May 2027.
