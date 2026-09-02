# PYQ backfill — remaining plan

Written 3 Sep 2026, at the end of a session. **A fresh session should read this
before touching ingestion.** It exists because the run IDs below live nowhere
else, and without them four part-finished papers would have to start over.

## Where it stands

**Loaded and live: 1,472 questions**, every one with an explanation.

| Paper | Years done | Questions |
|---|---|---|
| GS1 | 2014, 2015, 2016, 2017, 2021–2026 | 993 |
| CSAT | 2021–2026 | 479 |

**Remaining: 10 papers** — GS1 2018/2019/2020, CSAT 2014–2020.

All 26 PDFs and their answer keys are in `PYQs/Prelims/`, and **every page is
already rendered** under `.ingest/pages/` (gitignored). No re-rendering needed.

## Four papers are part-finished — resume, do not restart

These were running when the session ended. Completed agents replay from cache,
so resuming costs a fraction of a fresh run. **Resume before launching anything
new.**

| Paper | resumeFromRunId |
|---|---|
| CSAT 2014 | `wf_69a47db1-2b4` |
| GS1 2018 | `wf_f222d64a-527` |
| GS1 2019 | `wf_8e318277-34d` |
| GS1 2020 | `wf_56cafffb-d7f` |

```
Workflow({
  scriptPath: 'C:\\Users\\KIIT\\Mission 2027\\Sarthi\\workflows\\scripts\\ingest-paper.js',
  resumeFromRunId: '<id above>',
  args: <same args — get them from scripts/batches.mjs>
})
```

## Then the six not yet started

CSAT 2015, 2016, 2017, 2018, 2019, 2020 — launch fresh.

## The loop, per paper

Get the args (page counts differ by year, so never hardcode batches):

```bash
node scripts/batches.mjs GS1 2018
```

1. **Run** `ingest-paper.js` with those args. Two to four concurrent is
   comfortable; more has repeatedly been cut short.
2. **Collect** — `node scripts/collect-ingest.mjs <task-output.json>`. Writes
   `seed/questions-<paper>-<year>.json` and prints agreement, disagreements,
   unusable key entries and topic-tree gaps.
3. **Verify by hand — do not skip.** Open the key image in
   `PYQs/Prelims/GS PAPER {1,2}/` with the Read tool and check **every**
   disagreement against it. This is what distinguishes a hard paper from a
   misread key, and it has already caught a handwritten "C or D" (CSAT 2021
   Q39) and an arithmetically impossible key (CSAT 2025 Q59). If a paper
   scores 100%, sample ~50 answers across all key columns instead — a perfect
   score is a result to distrust, not celebrate.
4. **Mark reviewed** — `node scripts/mark-reviewed.mjs <file> "<what you
   actually checked>"`. The note is the only record; write what was verified,
   not a rubber stamp.
5. **Load** — `node --import tsx scripts/ingest-questions.ts <file> --confirm`.
6. **Commit and hand over the push command.** Phase-wise, per Pragaman's
   instruction on 3 Sep: commit after each batch of papers so nothing is lost
   if a session ends. He pushes; you never deploy.

## Rules that apply here

- **Official key wins**, except where the answer is *computable* and the key
  contradicts the arithmetic (D44) — then store the derived answer, set
  `disputed = true`, and say so in the explanation. Never for comprehension or
  judgement questions.
- An unusable key entry lands in `key_raw` and is flagged, never coerced.
- The reconcile phase rewrites explanations that argue against the key, so no
  question ever displays one answer while its explanation defends another.
- **Do not touch `seed/topics.json`.** See below.

## The open decision: topic-tree gaps

The 186 topics were designed from 2021–2026 papers only. The older papers keep
asking things the tree does not name, and the tagger flags each one rather than
force-fitting. Recurring so far, across GS1 2014–2017:

- political theory as a concept (2017 asked two)
- international NGOs and humanitarian bodies (IUCN, WWF, MSF, Wetlands International)
- tribal communities and community conservation — UPSC files these under Environment; the only tribal topic in the tree is inside the Sociology optional
- standards and certification bodies (BIS, AGMARK, QCI, FSSAI)
- social justice and welfare of vulnerable sections
- evolution, speciation and animal taxonomy
- watershed and rural development programmes
- the left wing of the national movement (CSP 1934, Communists)
- UNCCD and desertification

**Collect these across all 26 papers and bring Pragaman ONE consolidated
proposal at the end.** Do not add topics paper by paper, and do not edit
`topics.json` without his approval — the precedent is D30, where six bonus
topics were proposed, approved, and kept out of the study plan so they could
never displace scheduled work.
