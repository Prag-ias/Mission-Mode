# Sarthi — handoff

**Read this fully before touching anything. Then `CLAUDE.md`, then `state/build-state.json`.**

The build is **finished**. This document was rewritten on 31 Aug 2026, the day the app
entered daily use. If you are an assistant picking this up, your job is almost certainly
*not* to add features — see section 9 before you write a line of code.

---

## 1. What this is

**Sarthi** is a study system for one person preparing for the **UPSC Civil Services
Preliminary Examination on Sunday 23 May 2027**. It is not a product, has no market, and
will never have a second user.

The user is **Pragaman** — first attempt, working full-time as a Product & Growth Lead in
Pune, studying ~44 hours a week around a 9-to-6 job. He is a competent engineer and reads
the diff. He is also the only person who can judge whether a screen works at 05:30, which
is why human-verification items are tracked rather than assumed.

- **Live app:** https://sarthi-gamma.vercel.app
- **Repo:** https://github.com/Prag-ias/Mission-Mode (branch `main` is production)
- **Day 1 was 31 Aug 2026.** The routine is running. This is no longer a greenfield project.

## 2. The one rule

> **The app decides. The user executes.**

At 05:30 with a sharp brain and at 21:40 with a tired one, Sarthi must never ask *"what do
you want to study?"* It says: *Laxmikanth Ch.7, Fundamental Rights Part 2, 90 minutes.*

Decision-making is the scarcest resource here — scarcer than time. A feature that moves a
decision back onto the user is the wrong feature, however flexible it feels. This rule kills
flexible planners, drag-and-drop calendars, and "pick your focus today" screens — all things
a reasonable engineer would consider obviously good.

## 3. Dates that do not move

| Date | What |
|---|---|
| 31 Aug 2026 | Routine started. Done. |
| 1 Oct 2026 | Sociology enters Saturday 14:00–17:00 |
| 13 Jan – 2 Feb 2027 | UPSC application window (his job, not the app's) |
| **1 Feb 2027** | **Feature freeze. Bug fixes only after this.** |
| **23 May 2027** | **Prelims.** The only date that was ever real. |

## 4. Why the app is shaped this way

Six years of past papers were analysed to build it. Two findings drive everything:

**The exam stopped testing recognition and started testing certainty.** Since 2023, papers
are dominated by *"how many pairs are correct"*, *"Statement I, II and III"*, and — new in
2026 — *"which relationship among these statements holds"*. Knowing three facts out of four
earns zero. Partial knowledge is worthless.

That is why **the revision ladder is the heart of the product**, not the tracker. Coverage is
easy and worth ~85 marks; certainty needs five scheduled touches per topic — ~900 events
across 192 topics and 38 weeks, which no spreadsheet survives. If you ever have to choose
what to protect, protect `lib/ladder.ts` and `/revise`.

**His previous attempt failed at ignition, not stamina.** He planned 2026 thoroughly and
never really started. So the risk profile is weeks 1–3 (never starting) and months 3–5
(silent drift, where one skipped block becomes three). The streak counts **minimum-viable
days (≥160 min), not perfect days**, because a streak that punishes a hard Tuesday gets
abandoned in week six.

## 5. Current state — what is built and live

Everything below is shipped, tested, and in production.

| Version | Shipped | What it is |
|---|---|---|
| v0 | 30 Aug 2026 | Today screen, three blocks, log minutes, MVD ring, streak |
| v1 | 30 Aug 2026 | Syllabus grid, topic pages, notes with autosave, note search |
| v2 | 30 Aug 2026 | **Revision ladder engine + queue**, blind recall, missed-block debt |
| v3 | 31 Aug 2026 | PYQ bank, practice runner, confidence + reason codes, mistake log |
| v4 | 31 Aug 2026 | Mock scoring, audit dashboard, CA capture, decay meter, export, PWA |
| guide | 31 Aug 2026 | Top-right menu → daily routine (day-synced) + book tracker |
| enrich | 31 Aug 2026 | GS1 2025 load, dark mode, topic materials + reference links |

**Content in the database right now:**

- **593 questions** — GS1 2021–2026, all six years, **every one with an explanation**
- **192 topics** — 186 planned + 6 bonus (see D30: bonus topics are never scheduled)
- **252 reference links** across all 192 topics, every URL verified HTTP 200
- 11 subjects · 7 phases · 912 plan blocks · PASS2–4 revision events seeded
- 21 books tracked with have / to-buy / free-PDF status

**Test suite: 36 tests, all passing.** `tests/v0…v4.spec.ts`, `guide.spec.ts`, `enrich.spec.ts`.

## 6. Stack, layout and credentials

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · postgres-js ·
Postgres on Supabase (ap-south-1) · deployed on Vercel via GitHub auto-deploy · Playwright.

Server components by default. No state library. No auth library. No charting library.

```
app/                    routes; actions.ts files hold server actions
  page.tsx              Today — the 05:30 screen
  revise/               the queue + blind recall            ← the heart
  syllabus/  topic/     coverage grid, topic detail, notes, materials
  practice/  tests/     PYQ practice runner, mock entry
  audit/     ca/        Sunday dashboard, current-affairs capture
  guide/                routine + book list
  api/export            whole DB as JSON
  api/material/[id]     opens a material (signed URL for files)
components/             BlockCard, PracticeRunner, NoteEditor, GuideMenu, ThemeToggle…
db/schema.ts            15 tables. Use as-is.
lib/                    dates (IST), ladder, sweep, practice, stages, storage, routine, db, auth
seed/*.json             real content — never regenerate or hand-edit
scripts/                seed, generate-plan, sync-links, ingest-questions, render-pages…
state/                  build-state.json (machine) + build-log.md (append-only)
docs/DECISIONS.md       D1–D40. Record anything you decide autonomously.
tests/                  Playwright specs — the only proof that counts
```

**Environment (`.env.local`, gitignored — never print these values, never put them in chat):**

| Key | What | Also needed on Vercel |
|---|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** URI, port 6543 | yes |
| `SARTHI_PASSWORD` | the single app password | yes |
| `SUPABASE_SERVICE_KEY` | service_role key — enables file uploads | yes |

All three are set in production and preview. `npm run dev` · `npm run build` · `npm run lint`
· `npx tsc --noEmit` · `npx playwright test`.

## 7. How the app is operated (this is now the main job)

**The user pushes. You do not deploy.** Standing instruction since the design pass: make the
change, commit, merge to `main` locally, then hand him the command. He pastes it. Vercel
auto-deploys from `main`.

```bash
git push origin main
```

Rituals that keep the data honest:

| When | What | Command |
|---|---|---|
| Weekly, if >7 days drifted | Re-plan future blocks; history is immutable | `node scripts/generate-plan.mjs --from <Monday>` then `npm run seed` |
| After editing the links sheet | Re-import reference links | `node scripts/sync-links.mjs` |
| First Sunday monthly | Export a backup — one tap on /audit | `/api/export` |
| When a paper is ingested | Load it (refuses without human review) | `node --import tsx scripts/ingest-questions.ts <file> --confirm` |

The **Google Sheet** is the editor for reference links; the DB is the truth. Sheet rows sync
as `source='sheet'` and are replaced wholesale; rows he adds in the app (`source='user'`) are
never touched by a sync. The sync reads the **first tab** — never pin a `gid`, because a CSV
import replaces the tab and changes it.

## 8. Hard-won gotchas — read before debugging anything

These cost real hours. Do not rediscover them.

1. **Wide `Promise.all` deadlocks postgres-js on this stack (D36).** A 13-way parallel read
   wedged `/api/export` for 60s+, reproduced standalone. Fan-outs beyond ~4 queries must run
   **sequentially**. Pool is `max: 10` with explicit timeouts in `lib/db.ts`.
2. **All dates are IST, always.** Vercel runs UTC. Use `todayIST()` / `hourIST()` from
   `lib/dates.ts` — never `new Date()` for a calendar day.
3. **A zombie dev server will lie to you.** A stale process holding port 3000 served old
   webpack chunks and produced *"Cannot read properties of undefined (reading 'call')"* on
   every machine, while fresh servers passed. If you see impossible client errors, check for
   an orphaned process before theorising about the code.
4. **The app is in live daily use.** Specs must assert *relative to real logged data*, never
   against a zero baseline — `v0.spec.ts` reads the day's actual minutes first. Test fixtures
   use throwaway codes (`TEST-*`, slots `T1/T2`) and teardown must delete children first
   (revision events before topics) or you get FK violations.
5. **Uploads are gated on the key.** `storageReady()` is false without
   `SUPABASE_SERVICE_KEY`; the UI says so rather than half-working. Files live in a *private*
   bucket and open through 1-hour signed URLs — a shared link expires by design.
6. **Tailwind v4 dark mode here is manual** (D38): `data-theme="dark"` on `<html>`, set by an
   inline script in `<body>` before paint. It deliberately ignores `prefers-color-scheme` —
   at 05:30 the phone is still in night mode and the app should not follow it.

## 9. What you must not do

- **Do not add features after 1 February 2027**, under any framing, including "this would
  only take an hour". If asked, cite this line before writing code.
- Do not add an auth library, users table, or any multi-tenancy. One password, one env var.
- Do not add a state management library, or a charting library (the audit's four charts are
  hand-rolled SVG and stay that way).
- Do not regenerate or hand-edit `seed/*.json`. `plan-blocks.json` is written only by
  `generate-plan.mjs`.
- Do not make the two hardcoded rules configurable: **Saturday 14:00–17:00 is Sociology
  only**, and **Block C (21:40) is revision and MCQs only, never new material**.
- Do not refactor working code unless a test is failing.
- Do not write congratulatory copy. "Block A — 95 min", never "Great work!"
- Do not deploy. Hand him the git command.
- Do not put secrets in chat. They live in `.env.local` and Vercel's secret store.

## 10. What is genuinely left

Everything below is optional. The build order is complete.

| Item | Size | When it matters |
|---|---|---|
| **CSAT ingestion** — 6 papers (D27) | ~2 sessions + his review | Before CSAT Saturdays start, December |
| Offline write queue (D35) | medium | Only if logging offline actually bites |
| Notifications (D5) | small | Revisit ~14 Sept, only if 05:30 is slipping |
| Practice `topic=` filter | ~1 h | `lib/practice.ts` parses it; the runner SQL ignores it. Completing it enables "drill this topic" from a topic page |

**Anti-metrics that decide whether a change is good:** time in app under 20 min/day excluding
practice; build hours ≤4 in any week; and after November, *days since last commit going up is
a good sign*. The healthiest possible outcome from here is that this repo stops changing.

## 11. When to stop and ask

Stop — do not guess — when: a change would break a rule in section 9; you need a credential
or paid service; you find something in the seed data that looks wrong (report, never silently
fix); or a change would alter history in `daily_logs`, `attempts`, or completed
`revision_events`. Those tables are his record of work done and are effectively immutable.

Otherwise decide, record it in `docs/DECISIONS.md`, and keep moving. He would rather review
five decisions than answer five questions at midnight.

## 12. Tone

Plain and specific. He is an engineer and will read the diff. Tell him what you built, what
you decided, what you could not verify, and what you would cut. No enthusiasm, no summaries
of things he can see in the commit log. There is no one to impress and an exam to pass.
