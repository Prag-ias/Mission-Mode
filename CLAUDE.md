# Sarthi — project memory

A study system for one person, one exam, one date: **UPSC CSE Prelims, Sunday 23 May 2027**.

## The one rule

**The app decides, the user executes.**

At 05:30 with a sharp brain and at 21:40 with a tired one, Sarthi must never ask
*"what do you want to study?"* It says: *Laxmikanth Ch.7, Fundamental Rights Part 2,
90 minutes.* Every screen that asks the user to choose spends energy they need for the
book. Decision-making is the scarcest resource in this project, not time.

If a feature you are about to add moves a decision back onto the user, it is the wrong
feature — even if it feels flexible and helpful.

## Who uses this

One person. Pragaman. Full-time job, studying ~44 hrs/week around it. Three states:

- **05:30, sharp, 90 min** — wants one instruction, opens the app for eleven seconds.
- **21:40, tired, 70 min** — cannot plan or choose. Wants a queue decided hours ago.
- **Sunday, laptop, analytical** — wants the honest numbers. The only place density is allowed.

## Hard constraints

- **Single user.** No users table, no orgs, no tenancy, no sharing, no onboarding, no
  empty states for a stranger. A password in an env var is the entire auth story.
- **Build hours are study hours.** Total budget for the whole app is ~62 hrs across 22
  weeks. If a task is taking longer than its budget, cut scope, don't extend time.
- **Feature freeze 1 February 2027.** Bug fixes only after that date. Do not add features
  after it under any framing, including "this would only take an hour".
- **Mobile-first.** Test every screen at 390px. It must be usable one-handed.
- Never regenerate or hand-edit `seed/*.json`. It is real content, built once.

## Two rules that are hardcoded on purpose

1. **Saturday 14:00–17:00 (`SC`) is Sociology and nothing else**, from 1 Oct 2026. It is
   the single most likely thing to be quietly squeezed. Do not make it configurable.
2. **Block C (21:40–22:50) is always revision and MCQs.** No new material after 21:40.

## Decisions already made — do not relitigate

| | Decision |
|---|---|
| Optional subject | Sociology |
| Answer keys | Official UPSC where it exists; **one named** coaching fallback otherwise; disagreements get `disputed = true`, a visible badge, and exclusion from accuracy stats |
| Explanations | Generated **upfront** during ingestion, never at runtime |
| Sociology in-app | A normal subject, revision ladder **on**, PYQ drills **off** (`topics.pyq_drills = false`) |
| Missed blocks | Auto-reschedule **at most twice** (`reschedule_count`), then it becomes visible debt cleared by hand |
| Notifications | Deferred entirely |
| Plan storage | Seeded upfront for all 267 days; re-planned weekly with `--from`; history immutable |

## Stack

Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Postgres on Supabase ·
Drizzle ORM · deployed on Vercel · git.

Server components by default. Client components only where an interaction genuinely needs
one. No state library. No charting library until there are at least four charts.

## Repository layout

```
db/schema.ts             13 tables. Already written. Use as-is.
seed/*.json              real content — 186 topics, 7 phases, 912 plan blocks
scripts/generate-plan.mjs  the planner; re-run weekly with --from
scripts/seed.ts          loads seed/*.json into Postgres, idempotent
prompts/                 the kickoff prompt for each version
```

## Build order — do not work ahead

| Version | Ship by | Scope | Budget |
|---|---|---|---|
| v0 | 30 Aug 2026 | Today view, three blocks, tick, minutes, streak | 5 h |
| v1 | 27 Sep 2026 | Syllabus tree, coverage grid, notes | 9 h |
| v2 | 1 Nov 2026 | Revision ladder engine and queue | 10 h |
| v3 | 20 Dec 2026 | PYQ bank, practice mode, mistake log | 12 h |
| v4 | 31 Jan 2027 | Mock scoring, audit dashboard, CA capture, PWA, export | 12 h |
| — | 1 Feb 2027 | **Feature freeze** | — |

When a version's acceptance criteria pass, **stop**. Do not start the next version early
and do not add polish features. If there is time left, improve the mobile layout of what
exists.

## Anti-metrics

- Time in the app, excluding practice mode: **under 20 min/day**. Above that, the app is
  stealing study time and features should be *removed*.
- Build hours: **≤ 4 in any week**.
- After November, days since last commit going up is a good sign.

## Voice

Copy is plain, direct, and never congratulatory. "Block A done — 95 min" not
"Great work! You crushed it!" There is no one to impress and eight months to go.
