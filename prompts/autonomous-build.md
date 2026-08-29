# Autonomous build loop

This is the operating prompt for every session after v0. It is the same prompt each time —
`state/build-state.json` is what makes it resolve to different work.

---

## Step 0 — Orient (always, before anything else)

Read, in this order:

1. `HANDOFF.md` — full project context
2. `CLAUDE.md` — the durable rules
3. `state/build-state.json` — where the build actually is
4. `state/build-log.md` — the last two entries only
5. `docs/DECISIONS.md` — decisions already recorded
6. `prompts/later-versions.md` — the spec for `current_version`

Then run `git log --oneline -15` and `npm run build` to see whether the tree is healthy.

If the last session ended mid-version, resume from `state.open_tasks`. If the last session
ended at a gate and `state.gate_approved` is `false`, **stop immediately** and tell the user
the gate is still waiting on them. Do not start the next version.

## Step 1 — Plan before you write

Do not open an editor yet.

Write a task breakdown for this version and put it in `state.open_tasks`. Each task must be:

- **Independently shippable** — it compiles, tests pass, and it can be committed alone.
- **Estimated in minutes**, honestly. Sum them. If the total exceeds this version's budget
  by more than 20%, cut scope now and say what you cut and why — do not plan to be fast.
- **Ordered by dependency**, with the riskiest structural task first. In v2 that is the
  ladder scheduling logic, not the queue UI. Discover the hard problem on day one, not day
  four.

Then, before writing feature code, **write the version's Playwright spec** (`tests/vN.spec.ts`)
from the acceptance criteria. Failing tests are the plan made executable. Any criterion that
cannot be automated goes in a `needs_human_verification` list in the state file.

Show the user the plan and the estimate. Then start — do not wait for approval on the plan.
Approval happens at the gate, not before every task.

## Step 2 — Execute

For each task, in order:

1. Implement the smallest correct version of it.
2. Run `npx tsc --noEmit` and the relevant tests.
3. Commit with a message naming the version and task: `v2: schedule D+1/7/30/90 on read`.
4. Update `state.open_tasks` — move it to `state.done_tasks` with actual minutes spent.

Rules while executing:

- **Smallest correct thing.** An abstraction that serves one caller is premature. There will
  never be a second caller; this app has one user and a hard end date.
- **When you find yourself building something not in the task list, stop.** Add it to
  `state.deferred` with one line on why, and carry on with the current task.
- **Log actual minutes honestly**, including time spent debugging. The budget is only useful
  if the numbers are real.
- If a task runs more than double its estimate, stop, write what happened to the build log,
  and reassess the rest of the version before continuing.

## Step 3 — Verify

A version is not done because the code reads correctly. It is done when:

- [ ] `tests/vN.spec.ts` passes against a database freshly seeded from `seed/*.json`
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run lint` is clean
- [ ] Every screen you touched renders correctly at **390px** — check it, don't assume
- [ ] No feature from a later version has crept in
- [ ] `npm run seed` is still idempotent

Then re-read the version's acceptance criteria one at a time and mark each **pass**, **fail**,
or **needs human verification**. Be strict. "Mostly works" is a fail.

## Step 4 — Gate report, then stop

Append an entry to `state/build-log.md`:

```markdown
## vN — <date>
**Shipped:** what actually works now, in one paragraph.
**Hours:** estimated X, actual Y. Where the difference went.
**Decisions:** anything recorded in docs/DECISIONS.md this session, one line each.
**Needs human verification:** the criteria only he can judge — name them specifically.
**Deferred:** what you chose not to build and why.
**Risk for next version:** the thing most likely to bite in vN+1.
**If the next version runs long, cut:** name it now, while you can think clearly.
```

Update `state/build-state.json`: set `current_version` to the next one,
`gate_approved: false`, clear `open_tasks`, record `hours_actual`.

Then **stop and tell the user the gate is open**. Say plainly what you need him to check —
he should be able to verify it in ten minutes on his phone, so give him a short list, not a
tour.

## Step 5 — Resuming after a gate

When he says the gate is approved, set `gate_approved: true`, and go back to Step 0.

---

## The three failure modes to watch for in yourself

**Scope creep wearing a productive disguise.** The most dangerous sentence in this project is
*"while I'm in here, I'll just…"*. Every hour you spend is an hour he does not spend reading
Laxmikanth. If it is not in the current version's spec, it goes in `state.deferred`.

**Building the flexible version.** You will be tempted to make the plan configurable, the
slots editable, the revision intervals tunable. Resist all three. The rigidity is the product
— section 4 of `HANDOFF.md` explains why. Configurability moves a decision back onto a tired
person at 21:40.

**Grading your own homework.** You cannot judge "usable one-handed at 05:30" and you cannot
judge whether the copy reads as encouraging or as nagging. Name those honestly in the gate
report rather than marking them passed.

---

## Between versions — the two maintenance jobs

These are small and belong to whichever session notices they are due.

**Weekly re-plan.** If more than seven days of blocks are `skipped` or `rescheduled`, run:

```bash
node scripts/generate-plan.mjs --from <next Monday> --existing seed/plan-blocks.json
```

History before `--from` is never rewritten. Read the by-subject hours it prints and the
warning list at the bottom. If a subject appears in the warning list — meaning a topic would
not get its full first reading before 23 May — say so in your report. **Do not silently
rebalance `phases.json`.** That is a study decision, not an engineering one, and it is his.

**PYQ ingestion**, from Phase 1 onward, one paper per fortnight. The pipeline is in
`README.md` and is proven — it produced clean text from the 2026 paper. Six GS Paper 1 papers
only; CSAT is out of scope. Every ingested question needs `answer_source` set per decision D1,
and 30 minutes of human review before it enters the bank. **Never let an unreviewed answer key
into the database** — a wrong answer in a memory system teaches the wrong fact for eight months.
