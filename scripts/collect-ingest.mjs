#!/usr/bin/env node
/**
 * Turns an ingest-paper workflow result into a loadable question file, for
 * either GS1 or CSAT. The pipeline already carries the official key and a
 * worked explanation per question, so this writes a file the loader accepts
 * once a human marks it reviewed.
 *
 * Reports everything that needs a human eye: key-vs-solver disagreements,
 * unusable key entries, figure-dependent questions, and tagging gaps (a
 * question no topic in the tree genuinely covers).
 *
 *   node scripts/collect-ingest.mjs <task-output.json> [outfile]
 */
import fs from 'node:fs'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/collect-ingest.mjs <task-output.json> [outfile]')
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(src, 'utf8'))
const r = raw.result ?? raw
const paper = r.paper
const year = r.year
if (!paper || !year) {
  console.error('workflow result has no paper/year — did the run fail?')
  process.exit(1)
}
const isCsat = paper === 'CSAT'
const out = process.argv[3] ?? `seed/questions-${paper.toLowerCase()}-${year}.json`

const questions = (r.questions ?? []).map((q) => {
  const codes = q.topic_codes?.length ? q.topic_codes : isCsat ? ['CSA-01'] : null
  return {
    q_no: q.q_no,
    page: q.page ?? null,
    stem: q.stem,
    options: q.options,
    answer: q.answer ?? null,
    answer_source: q.answer_source ?? null,
    disputed: !!q.disputed,
    format: q.format ?? 'simple',
    subject_code: q.subject_code ?? (isCsat ? 'CSAT' : null),
    topic_codes: codes,
    primary_topic_code: q.primary_topic_code ?? codes?.[0] ?? null,
    explanation_md: q.explanation_md ?? null,
    has_table: !!q.has_table,
    has_figure: !!q.has_figure,
    tagging_confidence: q.tagging_confidence ?? null,
    tagging_note: q.tagging_note ?? null,
    transcription_note: q.note ?? null,
    shares_passage_with: q.shares_passage_with ?? null,
    independent_answer: q.independent_answer ?? null,
    dropped_by_upsc: !!q.dropped_by_upsc,
    key_supported: q.key_supported !== false,
    key_raw: q.key_raw ?? null,
    review_flag: q.review_flag ?? null,
  }
})

const file = {
  paper,
  year,
  booklet_series: r.booklet_series ?? null,
  source_pdf: `PYQs/Prelims/${isCsat ? 'GS PAPER 2' : 'GS PAPER 1'}/${isCsat ? 'GS PAPER 2' : 'GS PAPER 1'} ${year}.pdf`,
  transcribed_on: new Date().toISOString().slice(0, 10),
  reviewed_by_human: false,
  answer_key: { source: 'official', note: 'Official UPSC answer key supplied by the user.' },
  independent_pass: {
    done_on: new Date().toISOString().slice(0, 10),
    note: 'Every question answered from scratch before the key was read; that answer is the explanation.',
  },
  explanations_generated: { on: new Date().toISOString().slice(0, 10), note: 'Written during the solve pass (D2).' },
  questions,
}

fs.writeFileSync(out, JSON.stringify(file, null, 1))

const flagged = questions.filter((q) => q.review_flag)
const disputed = questions.filter((q) => q.disputed)
const noAnswer = questions.filter((q) => !q.answer && !q.dropped_by_upsc)
const noExpl = questions.filter((q) => !q.explanation_md)
const noTopic = questions.filter((q) => !q.topic_codes?.length)
const figures = questions.filter((q) => q.has_figure)
const badKey = questions.filter((q) => q.key_raw)
const { agree = 0, scored = 0 } = r.agreement ?? {}

console.log(`${out} — ${questions.length} questions`)
console.log(`  blind agreement with key: ${agree}/${scored}${scored ? ` (${Math.round((agree / scored) * 100)}%)` : ''}`)
console.log(
  `  missing answer ${noAnswer.length} · missing explanation ${noExpl.length} · untagged ${noTopic.length} · has figure ${figures.length} · disputed ${disputed.length}`,
)
if (badKey.length) for (const q of badKey) console.log(`  ! Q${q.q_no} key entry unusable: "${q.key_raw}"`)
for (const q of flagged) console.log(`   Q${String(q.q_no).padStart(3)} ${q.review_flag}`)

const gaps = (r.tagging_notes ?? []).filter((g) => /no topic|not covered|gap|none of the|outside/i.test(g.note ?? ''))
if (gaps.length) {
  console.log(`\n  topic-tree gaps flagged by the tagger (${gaps.length}):`)
  for (const g of gaps) console.log(`   Q${g.q_no}: ${g.note}`)
}
