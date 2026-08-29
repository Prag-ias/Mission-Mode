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
