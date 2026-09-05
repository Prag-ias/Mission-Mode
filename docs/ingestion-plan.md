# PYQ backfill — CLOSED

**Status as of 5 Sep 2026: the GS1 backfill is complete, and the CSAT backfill was
stopped by Pragaman. Nothing here is outstanding.** This is kept as the record of how
it was done, and as the starting point if CSAT 2014-2020 is ever wanted.

## Final state

**1,770 questions live, every one with an explanation.**

| Paper | Years | Questions |
|---|---|---|
| GS1 | 2014-2026, all thirteen | 1,291 |
| CSAT | 2021-2026 | 479 |

GS1 blind agreement by year: 2014 95/100 · 2015 100/100 · 2016 100/100 · 2017 96/100 ·
2018 98/100 · 2019 95/100 · 2020 92/98. Every key-vs-solver disagreement was re-read
against the key image by hand before the paper was loaded, and the two perfect papers
were each checked by sampling 50 answers across every column of the key.

## CSAT 2014-2020 — stopped, not failed

Pragaman stopped this on 5 Sep 2026: it is not wanted. **Do not restart it without
asking.** Nothing needs redoing first if it ever is — pages for `csat_2014` through
`csat_2020` are already rendered under `.ingest/pages/` and the keys are in
`PYQs/Prelims/GS PAPER 2/`.

## How a paper was ingested, if this is ever repeated

```bash
node scripts/batches.mjs GS1 2018        # page counts differ by year; never hardcode
```

1. Run `workflows/scripts/ingest-paper.js` with those args — transcribe, verify, solve
   blind, read the key, tag, reconcile. Two to four concurrent is comfortable.
2. `node scripts/collect-ingest.mjs <task-output.json>` — writes the seed file and
   prints agreement, disagreements, unusable key entries and topic-tree gaps.
3. **Verify by hand.** Open the key image and check every disagreement against it. This
   caught a handwritten "C or D" (CSAT 2021 Q39), an arithmetically impossible key
   (CSAT 2025 Q59), and two X-marked dropped questions (GS1 2020 Q27/Q52). If a paper
   scores 100%, sample ~50 answers across all key columns instead — a perfect score is
   a result to distrust, not celebrate.
4. `node scripts/mark-reviewed.mjs <file> "<what you actually checked>"`.
5. `node --import tsx scripts/ingest-questions.ts <file> --confirm`.
6. Commit per paper; Pragaman pushes.

**Official key wins**, except where the answer is computable and the key contradicts the
arithmetic (D44) — then store the derived answer and set `disputed = true`. Never for
comprehension or judgement questions.

## Still open: the topic-tree gaps

The 186 topics were designed from 2021-2026 papers only, and the older papers kept asking
things the tree does not name. The tagger flagged each rather than force-fitting. Themes
that recurred across GS1 2014-2020:

- abstract political theory and constitutionalism (asked most years)
- international NGOs and humanitarian bodies (IUCN, WWF, MSF, ILO, Wetlands International)
- tribal communities and community conservation — UPSC files these under Environment; the
  only tribal topic in the tree sits inside the Sociology optional
- standards and certification bodies (BIS, AGMARK, QCI, FSSAI)
- social justice and welfare of vulnerable sections; education policy and the RTE Act
- evolution, speciation, animal taxonomy and plant physiology
- watershed and rural development programmes; post-independence land reforms
- remote sensing and GIS; geoengineering
- the anti-caste movement and the left wing of the national movement
- Aadhaar, DBT and digital identity on the polity side
- world conflicts, world lakes, dams and reservoirs, global health governance

**This is the one thing still awaiting Pragaman's decision.** The precedent is D30: propose
bonus topics, get approval, and keep them out of the study plan so they can never displace
scheduled work. `seed/topics.json` has not been touched.
