# Decisions

Architecture decisions, newest last. One entry per decision, kept short.

Record here anything you decided **autonomously** — a library choice, a schema change, a
behaviour the spec did not cover. The user reviews these at the gate rather than being asked
at midnight.

Format: `### DN — <decision>` then **Context**, **Decision**, **Consequence** in one line each.

---

### D1 — Answer key provenance
**Context:** UPSC publishes official keys only after the full cycle closes; coaching keys disagree on 3–5 questions a year.
**Decision:** Official key where it exists; **one named** coaching fallback otherwise; disagreements get `disputed = true`.
**Consequence:** Disputed questions are still practised but excluded from accuracy statistics, and show a badge.

### D2 — Explanations generated upfront
**Context:** 600 questions need explanations; generating at runtime costs latency and risks hallucinated answers during revision.
**Decision:** Generate during ingestion, in batches of 20, reviewed before storage.
**Consequence:** ~10 hours added to ingestion; `explanation_md` is never null in production; works offline.

### D3 — Sociology lives in the same tree
**Context:** The optional has 28 topics and needs the revision ladder, but Prelims PYQs do not cover it.
**Decision:** A normal subject with `topics.pyq_drills = false`.
**Consequence:** One revision queue and one coverage grid; practice mode filters Sociology out automatically.

### D4 — Missed blocks auto-reschedule at most twice
**Context:** Auto-rescheduling is the point of a system, but it also hides drift — and drift is the failure mode this app exists to catch.
**Decision:** `reschedule_count` capped at 2; the third miss becomes a visible debt item cleared by hand.
**Consequence:** Bad weeks absorb gracefully; sustained slippage becomes impossible to ignore.

### D5 — Notifications deferred
**Context:** A 05:15 push either saves the routine or gets dismissed by week three, and nobody knows which.
**Decision:** Build nothing. Revisit after two weeks of the routine running.
**Consequence:** No push infrastructure, no permissions prompt, no service-worker complexity in v0–v4.

### D6 — The plan is seeded upfront
**Context:** All 267 days planned at once makes the coverage map honest from day one; weekly generation adapts better to reality.
**Decision:** Seed upfront, re-plan weekly with `--from`, never rewrite history.
**Consequence:** `generate-plan.mjs` is the only writer of `plan-blocks.json`; completed blocks are immutable.

### D7 — Stack
**Context:** Build speed matters more than anything technically interesting; the user already ships on Vercel.
**Decision:** Next.js on Vercel, Postgres on Supabase, Drizzle, Tailwind + shadcn/ui, git.
**Consequence:** No new accounts, no new mental models, no state library, no charting library before v4.

### D8 — Manual scaffold instead of create-next-app
**Context:** The tool-permission layer blocked `npx create-next-app` in the build session.
**Decision:** Hand-write the same scaffold with pinned versions: Next 15.5, React 19.1, Tailwind 4, TS strict.
**Consequence:** Identical layout to create-next-app output; versions move only when a human bumps them.

### D9 — No shadcn/ui in v0
**Context:** v0 has three interactive elements (two inputs, one button); shadcn init plus theming is overhead with no component need yet.
**Decision:** Plain Tailwind primitives for v0; add shadcn/ui when a version actually needs a composed component.
**Consequence:** Nothing to unlearn later; revisit at v1 (notes editor) or v3 (practice mode).

### D10 — All date logic runs in IST
**Context:** Vercel serves from UTC; the IST calendar date differs from UTC between 00:00 and 05:30 IST — exactly when Block A is opened.
**Decision:** One `todayIST()` helper (Intl, Asia/Kolkata) is the only source of "today"; DB dates stay ISO strings end to end.
**Consequence:** No date maths on Date objects anywhere; the 05:29 edge cannot shift the day.

### D11 — Done blocks get a small "fix" affordance
**Context:** Spec: a done block recedes but is never removed. A fat-fingered minutes entry at 05:30 would otherwise be uncorrectable until v4's export.
**Decision:** The receded card keeps a low-key "fix" button that reopens the minutes input and re-logs.
**Consequence:** Same server action, no extra route; daily_logs recomputes on every log so corrections stay consistent.

### D12 — Streak display during a day in progress
**Context:** streak_count is stored per completed day; today at 06:00 has no MVD yet and a literal read would show 0 all day.
**Decision:** Footer shows today's streak once today meets MVD, otherwise yesterday's streak.
**Consequence:** A hard day shows the streak it is defending, not a demoralising zero; the stored history stays pure.

### D13 — One password for DB and app gate
**Context:** User supplied a single password. SARTHI_PASSWORD (app gate) and the Supabase DB password are separate credentials.
**Decision:** Default SARTHI_PASSWORD to the same password the user gave; he can change the env var any time.
**Consequence:** One secret to remember; rotating either is a one-line env change, no code.

### D14 — Backdated logging window is exactly one day
**Context:** Block C ends 22:50 (Sat SE 23:00); a log made just after midnight belongs to yesterday.
**Decision:** logBlock accepts a block dated today or yesterday (marked `backdated`), refuses anything older; streak recomputes forward.
**Consequence:** The midnight edge works; bulk retro-logging stays impossible, which is the point of a daily log.

### D15 — Wrong-password feedback via ?bad=1
**Context:** v0 allows no second route, and a silent failed login is confusing even for one user.
**Decision:** Failed login redirects to `/?bad=1`; the gate renders "Wrong password." when the flag is present.
**Consequence:** One route preserved; no client state, no session storage, nothing to expire.
