# Build log

One entry per session, appended. Newest at the bottom.

Each entry: what shipped, hours estimated vs actual, decisions taken, what needs human
verification, what was deferred, the risk for the next version, and what to cut first if the
next version runs long.

---

## v0 — 2026-08-30

**Shipped:** The Today screen, live at https://sarthi-gamma.vercel.app. Password gate →
today's blocks in time order (topic name largest, source ref under it, subject colour dot,
time and planned minutes) → tap Done with a pre-filled minutes input → the block recedes in
place → sticky footer with total minutes, MVD against 160, and the streak. Data model pushed
to Supabase (ap-south-1) and seeded: 11 subjects, 186 topics, 7 phases, 912 plan blocks;
re-running the seed is proven safe. All date logic runs in IST. Playwright spec (3 tests,
390px viewport) passes against the production database: seed content including the exact
31 Aug blocks, both gate paths, log → recede → MVD flip at 160 → streak → reload persistence
→ fix flow. Teardown verified to leave zero residue.

**Hours:** estimated 5, actual ~4.5. Overrun sources: create-next-app blocked by tool
permissions (manual scaffold instead), Supabase password propagation delay, Vercel CLI
non-interactive quirks.

**Decisions:** D8–D15 recorded in docs/DECISIONS.md (manual scaffold; no shadcn in v0; IST
policy; "fix" affordance on done blocks; in-progress streak display; one password for both
credentials; one-day backdating window; ?bad=1 login feedback).

**Needs human verification:** (1) usable one-handed at 05:30 without glasses; (2) Monday
31 Aug shows NCERT Ch.1–3 / Laxmikanth Ch.1 / Revision queue live on the phone at 05:30 —
the spec asserts the rows, only Monday can show the screen; (3) copy tone; (4) app loads on
his phone (network, not emulation).

**Deferred:** nothing — v0 scope shipped whole.

**Risk for next version:** v1's notes (markdown, autosave, phone editing) is the piece most
likely to eat the budget; full-text search across notes is second. The coverage grid is
cheap by comparison.

**If the next version runs long, cut:** full-text search across notes first, then note
autosave (a save button costs one tap and zero engineering risk).

**Blocked on user, outside the gate:** first `git push` needs a one-time GitHub auth from
his terminal; the Vercel↔GitHub link he plans to do in the dashboard.

## v1 — 2026-08-30

**Shipped:** The syllabus layer. `/syllabus`: all 186 topics as a colour-coded grid grouped
by the 11 subjects, stage legend, touched/total per subject, and a notes search box
(`?q=` URL state, ILIKE over note bodies and topic names, snippets). `/topic/[code]`: name,
source ref, estimated first-read minutes, stage chip, an unread/reading/read control built
from three server-action forms (no client JS), and the note — a textarea that autosaves
800ms after typing stops and again on blur, tab-hide and unmount, with a Saved indicator.
`first_read_at` stamps on the first transition into read; `last_touched_at` on every stage
change and note save. Today's block headings now link to their topic. All six spec tests
green, plus the three v0 tests as regression; build, lint, tsc clean; all three screens
checked at mobile width.

**Hours:** estimated 7, actual ~3.5. The spec-first discipline paid for itself — zero
debugging rounds; every test passed on the first run.

**Decisions:** D16 (version branches, main stays deployable), D17 (stage ownership split
hands/ladder), D18 (ILIKE search, no full-text infrastructure).

**Needs human verification:** (1) note-taking feel on the phone keyboard — autosave should
be invisible, the Saved stamp glanceable; (2) grid cell tap accuracy one-handed (32px
targets); (3) whether the grid answers "what have I not touched?" at a glance once real
stages exist; (4) cross-device: a note typed on the phone appearing on the laptop.

**Deferred:** nothing from the v1 spec. Markdown *rendering* of notes was never in scope —
notes are written and re-read as plain markdown text until a version needs more.

**Risk for next version:** v2's ladder scheduling (D+1/7/30/90, recall-driven shortening,
PASS2–4 seeding from phase dates) is the real product and the hardest logic in the app —
it must come first in the plan, not the queue UI.

**If the next version runs long, cut:** blind-recall UI polish first (a plain textarea and
reveal is enough), then the debt number on the Today footer (the queue itself must not slip).

## design retrofit — 2026-08-30 (user-directed, pre-v2)

**Shipped:** Foundations v1 applied across all three screens and the gate. Work-mode
palette (warm #FAFAF7 bg, ink #16181D, coral #FF6B5E actions), Bricolage Grotesque for
display type (topic names, titles), Satoshi for body, Space Mono for stats/times/labels
(mono-label eyebrows at 11px/0.14em). Radius per spec (cards 18, buttons/inputs 10,
chips 6), warm-tinted shadows, 1px line borders everywhere. Logo (ink square, coral dot)
as favicon and on the gate. Satoshi variable woff2s committed; Bricolage/Space Mono via
next/font/google. Suite still 9/9; build/lint/tsc clean; Today (card + receded card),
syllabus and topic screens checked at 390px. ~1.5h, charged to no version budget
(user-directed scope between v1 and v2). Decisions D19–D21.

**Needs human verification:** whether coral-on-white Done reads as the one obvious action
at 05:30, and Bricolage's characterful letterforms stay readable without glasses at
card-title size.

**Not done on purpose:** stage/subject colours untouched (data, not chrome — D21); no
Caveat/sticker tokens (work mode only — D19); deploy left to the user's git push per his
new workflow.

## v2 — 2026-08-30

**Shipped:** The revision ladder — the heart. Reaching `read` schedules D+1/7/30/90 once,
ever; completing a rung advances the stage monotonically (D22). `/revise`: everything due,
most overdue first, hard-capped at 12 with the overflow as a single debt number that also
sits in the Today footer. D1 items open blind recall (`/revise/[id]`): the note is not
fetched until the attempt is typed, then 1–3 self-rating into `recall_score`; a 1 pulls D7
in to +3 (D23). PASS2–4 seeded for all 186 topics, spread across P3/P4/P5 windows —
558 events, idempotent (D25). Missed blocks: date-derived sweep, two days riding Today as
"owed", then block debt on /revise cleared by logging late (credits the day of the work)
or skipping (D24). Block C and every revision block now opens the queue. Suite 16/16
twice consecutively (repeatability proven), build/lint/tsc clean, queue and both recall
states checked at 390px.

**Hours:** estimated 7.8, actual ~5.2. One real bug found by the suite: v1's teardown
didn't know the v2 engine now creates events for its fixture topic (FK violation left a
stale topic). Fixed in the v1 spec; two other failures were spec bugs (Date-object
comparison, fixture outside the queue cap), not app bugs.

**Decisions:** D22–D25.

**Needs human verification:** (1) blind recall on the phone keyboard — the type-first
gate should feel like discipline, not friction; (2) whether "owed" cards on Today read
clearly at 05:30; (3) queue feel under real load — today it is empty by design until
topics reach `read`.

**Deferred:** nothing from the v2 spec.

**Risk for next version:** v3 needs the bank. The app work (practice UI, mistake log,
confidence) is straightforward; the schedule risk is ingestion — six papers with a 30-min
human review each. If PDFs arrive early, the bank leads the UI and v3 lands whole.

**If the next version runs long, cut:** keyboard shortcuts on desktop first, then year
filters (subject/topic/format/wrong-only are the load-bearing filters).

## v4 + design — 2026-08-31 (01:20, shipped hours before Day 1's Block A)

**Shipped:** The last version. /tests/new enters a mock's totals and per-subject rows in
about two minutes and scores it +2/−⅔; a subject under 60% pulls its three stalest topics
into the revision queue at day 3/5/7 (D33). /audit is the Sunday screen — adherence,
coverage, debt, rolling 3-mock average charted against 120 and the 92.66 cut-off, the
reason-code mix with the 15% misread line called out, and a freshness meter per subject
(D34) — all on one screen without scrolling. /ca captures a current-affairs item in under
twenty seconds with datalist topic tags; tagged items surface on their topic pages; Sundays
show the bio-geo-tech drill and each item carries a drill tick. /api/export returns every
table as JSON from one button. The app is installable (manifest + generated icons) and a
service worker read-caches pages so it opens offline with today's plan (D35 — the write
queue is deferred, stated, not half-built).

**Design:** the Sunsama-inspired pass. Day-arc tints — Block A wears dawn, B dusk, C
night — a sunrise wash at the top of every page, layered warm shadows, an MVD progress
ring in the footer, a time-of-day greeting, hover lifts, focus rings, reduced-motion
respect. Audit joined the bottom nav (bar-chart icon). Personality came from the product's
own soul — the shape of a day — not from decoration.

**Two real bugs found by building v4:** wide Promise.all fan-outs deadlock postgres-js on
this stack (reproduced standalone); export hung 60s+, audit likewise under load. Both now
sequential, pool at 10 (D36). Suite fell from 5.3 to 1.6 minutes. And the date rolled over
to Day 1 mid-session, which the v0 spec caught by colliding its fixtures with the real
31 Aug blocks — the spec now excludes its own slots.

**Suite:** 29/29 across v0–v4. Database verified pristine for the 05:30 session: three
Day-1 blocks planned, zero logs, zero fixtures.

**Hours:** ~5 of the 12 budget.

**Needs human verification:** mock entry under four minutes with a real scorecard; audit
"am I on track" legibility on the Sunday laptop; install-to-home-screen and offline open
on the actual phone; whether the day-arc tints read as calm or as noise at 05:30.

**Deferred:** offline write queue (D35); 2025 GS1 validation + load (transcribed and
keyed, one command away); CSAT ingestion (D27).

**With v4 shipped, the build order is complete.** Feature freeze per CLAUDE.md is
1 Feb 2027; between now and then: bug fixes, the deferred items above, and nothing else.
