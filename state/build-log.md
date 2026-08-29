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
