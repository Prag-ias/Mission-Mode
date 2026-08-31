# Restart prompt

Paste the block below into a fresh Claude Code session opened in
`C:\Users\KIIT\Mission 2027\Sarthi`. It carries no secrets, so it is safe to keep
anywhere. Everything it needs is in the repo — the files are the source of truth,
so this prompt stays correct even as the project moves.

Add your actual request at the end where marked.

---

```
You are picking up Sarthi, a finished single-user study app for my UPSC CSE Prelims
attempt on Sunday 23 May 2027. I am Pragaman — I work full time in Pune and study
~44 hrs/week around the job. Today the app is in daily use; it is not a greenfield build.

FIRST, read these in order and do not skip them:
  1. HANDOFF.md          — full context transfer, current state, gotchas, what not to do
  2. CLAUDE.md           — the durable rules
  3. state/build-state.json  — machine-readable state, open tasks, what needs my verification
  4. docs/DECISIONS.md   — D1-D40, every decision already made (do not relitigate these)
  5. state/build-log.md  — the session-by-session history, newest at the bottom

Then confirm you have read them by telling me, in three lines: what phase the project
is in, what is genuinely left, and what you are not allowed to do.

STANDING RULES — these override your defaults:

- The product rule is "the app decides, the user executes". Any feature that makes me
  choose something at 05:30 is the wrong feature.
- FEATURE FREEZE is 1 February 2027. After that date: bug fixes only, no exceptions,
  no matter how small the feature sounds.
- I deploy, you do not. Make the change, test it, commit, merge to main locally, then
  give me the `git push origin main` command in a bash code block and stop. Vercel
  auto-deploys from main.
- Secrets live in .env.local (gitignored) and Vercel's secret store. Never ask me to
  paste a key into chat, never print one, never commit one. The keys that exist are
  DATABASE_URL, SARTHI_PASSWORD and SUPABASE_SERVICE_KEY, and they are already set
  both locally and on Vercel.
- Never regenerate or hand-edit seed/*.json. It is real content built from six years
  of paper analysis. plan-blocks.json is written only by scripts/generate-plan.mjs.
- Spec-first. Nothing ships without a passing Playwright test. The suite is 36 tests
  (`npx playwright test`) and it runs against the real database, so fixtures must use
  throwaway TEST-* codes and clean up after themselves.
- Before saying anything is done, run: npx playwright test, npm run build, npm run lint,
  npx tsc --noEmit. Report failures honestly rather than describing intent.
- Mobile-first, 390px. Copy is plain and never congratulatory — "Block A — 95 min",
  not "Great work!".
- Work autonomously: decide, record it in docs/DECISIONS.md, keep moving. Only stop for
  credentials, seed-data problems, or anything that would rewrite my logged history
  (daily_logs, attempts, completed revision_events are immutable).

WHAT I WANT THIS SESSION:

<< write your actual request here — e.g. "ingest the six CSAT papers", or
   "dark mode looks gloomy at 21:40, fix it", or "just read everything and
   tell me the current state" >>
```

---

## If the repo is gone and only this file survives

Then the app is still live at https://sarthi-gamma.vercel.app and the code is at
https://github.com/Prag-ias/Mission-Mode — clone it and the files above come back.
If both are gone, the last JSON export from `/api/export` holds every row: 15 tables,
593 questions with explanations, 192 topics, 912 plan blocks, and all logged history.
Keep one somewhere that is not this machine.
