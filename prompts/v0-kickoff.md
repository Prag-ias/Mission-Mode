Build **v0 of Sarthi**, a single-user UPSC study app. Budget: 5 hours. Ship it today.

## Read these first, in this order

- `CLAUDE.md` — the durable rules for this project. The one that matters most: *the app decides, the user executes.*
- `db/schema.ts` — the Drizzle schema, 13 tables, already written. **Use it as-is.** Don't redesign it.
- `seed/subjects.json`, `seed/topics.json`, `seed/phases.json`, `seed/slots.json`
- `seed/plan-blocks.json` — 912 pre-planned study blocks from 31 Aug 2026 to 23 May 2027. This is the app's content. **Never regenerate or hand-edit it.**

## What v0 is

One screen. It shows today's study blocks and lets me log them. That is the whole product.

I start the routine on **Monday 31 August at 05:30**. If this isn't logging by then it has failed its only job.

## Setup

1. Scaffold: `npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"`
2. Add `drizzle-orm`, `postgres`, `drizzle-kit`, `dotenv`.
3. I'll create the Supabase project and put `DATABASE_URL` in `.env.local` — tell me when you need it.
4. Move `db/schema.ts` into place and push it with drizzle-kit.
5. Write `scripts/seed.ts`: loads all `seed/*.json` into `subjects`, `topics`, `phases`, `plan_blocks`. Resolves `topic_code` → `topic_id` and subject codes → ids. **Idempotent** — I will run it more than once. Expose it as `npm run seed`.

## The Today screen — route `/`

**Header:** today's date · days remaining to 23 May 2027 · the current phase name from `phases.json`.

**Body:** today's blocks in time order, read from `plan_blocks` where `date = today`. Weekdays have 3 (A, B, C), Saturdays 5 (SA–SE), Sundays 4 (U1–U4). For each block show:

- start time and planned minutes
- the subject's colour as a small dot (colours are in `subjects.json`)
- **the topic name as the largest text on the card** — this is the instruction, everything else is metadata
- the `source_ref` underneath, smaller (e.g. "Laxmikanth Ch.7")
- a large tap target to mark it done
- a number input for actual minutes, pre-filled with the planned value

**Footer, always visible:** today's total minutes · MVD status (met at ≥160 minutes) · current streak in days.

That is everything. No nav, no sidebar, no settings page, no charts, no dark-mode toggle.

## How it should behave

- **Mobile-first.** Design at 390px, then let it breathe on desktop. It has to work one-handed at 05:30 without glasses.
- Server components by default. One client component for the logging interaction, no more.
- A completed block **visibly recedes** — dimmed, struck, moved down — but is never removed from the screen. Seeing the day fill up is the point.
- Marking done writes `actual_minutes`, `status = 'done'`, `logged_at`, and recomputes the row in `daily_logs`.
- Streak counts consecutive days where `mvd_met = true`, not days where everything was done. Hard days should not break it.
- Auth: a single password checked against one env var, set in a cookie. **No auth library, no users table.**
- Copy is plain and never congratulatory. "Block A — 95 min" not "Great job!"

## Acceptance criteria — stop when all of these pass

- [ ] `npm run seed` loads 11 subjects, 186 topics, 7 phases and 912 plan blocks, and is safe to re-run
- [ ] Opening `/` on a phone shows today's real blocks with real topic names and source refs
- [ ] Monday 31 Aug shows: 05:30 NCERT 11 Fundamentals Ch.1–3 (Universe, Solar System, Earth's motions) · 19:00 Laxmikanth Ch.1 (Historical Background) · 21:40 Revision queue
- [ ] Marking a block done with actual minutes persists and survives a reload
- [ ] Footer total is correct, the MVD flag flips at 160 minutes, the streak counts consecutive MVD days
- [ ] Deployed to Vercel and loads on my phone
- [ ] Committed to git with a sane history

## Do not build

Notes, syllabus tree, coverage grid, revision queue, PYQ bank, practice mode, mistake log, mock entry, charts, dashboards, settings, notifications, offline support, PWA manifest, dark-mode toggle, any second route.

Every one of those has its own version and its own date in `CLAUDE.md`. Building one early takes hours from studying, which is the actual product.

**When the acceptance list passes, stop and tell me.** If you finish under budget, do not add features — spend the remaining time on the mobile layout of what already exists.
