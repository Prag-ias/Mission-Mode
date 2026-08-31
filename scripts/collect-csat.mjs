#!/usr/bin/env node
/**
 * Turns an ingest-csat-paper workflow result into a loadable question file.
 *
 * Unlike collect-paper.mjs (which deliberately produces an unreviewed draft),
 * the CSAT pipeline already carries the official key and a worked explanation
 * per question, so this writes a file the loader will accept. Questions where
 * the key and the independent solution disagree keep a review_flag and are
 * reported on stdout so they can be looked at.
 *
 *   node scripts/collect-csat.mjs <task-output.json>
 */
import fs from 'node:fs'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/collect-csat.mjs <task-output.json>')
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(src, 'utf8'))
const r = raw.result ?? raw
const year = r.year
const out = process.argv[3] ?? `seed/questions-csat-${year}.json`

const questions = (r.questions ?? []).map((q) => ({
  q_no: q.q_no,
  page: q.page ?? null,
  stem: q.stem,
  options: q.options,
  answer: q.answer ?? null,
  answer_source: q.answer_source ?? null,
  disputed: !!q.disputed,
  format: q.format ?? 'simple',
  subject_code: 'CSAT',
  topic_codes: q.topic_codes ?? ['CSA-01'],
  primary_topic_code: (q.topic_codes ?? ['CSA-01'])[0],
  explanation_md: q.explanation_md ?? null,
  has_table: !!q.has_table,
  has_figure: !!q.has_figure,
  transcription_note: q.note ?? null,
  shares_passage_with: q.shares_passage_with ?? null,
  independent_answer: q.independent_answer ?? null,
  dropped_by_upsc: !!q.dropped_by_upsc,
  key_supported: q.key_supported !== false,
  review_flag: q.review_flag ?? null,
}))

const file = {
  paper: 'CSAT',
  year,
  booklet_series: r.booklet_series ?? null,
  source_pdf: `PYQs/Prelims/GS PAPER 2/GS PAPER 2 ${year}.pdf`,
  transcribed_on: new Date().toISOString().slice(0, 10),
  reviewed_by_human: false,
  answer_key: { source: 'official', note: 'Official UPSC answer key supplied by the user.' },
  independent_pass: {
    done_on: new Date().toISOString().slice(0, 10),
    note: 'Every question solved from scratch before the key was read; the worked solution is the explanation.',
  },
  explanations_generated: { on: new Date().toISOString().slice(0, 10), note: 'Worked solutions written during the solve pass (D2).' },
  questions,
}

fs.writeFileSync(out, JSON.stringify(file, null, 1))

const flagged = questions.filter((q) => q.review_flag)
const disputed = questions.filter((q) => q.disputed)
const noAnswer = questions.filter((q) => !q.answer && !q.dropped_by_upsc)
const noExpl = questions.filter((q) => !q.explanation_md)
const incomplete = questions.filter((q) => q.has_figure)

console.log(`${out} — ${questions.length} questions`)
console.log(`  key vs worked solution: ${questions.length - flagged.length}/${questions.length} agree`)
console.log(`  missing answer ${noAnswer.length} · missing explanation ${noExpl.length} · has figure ${incomplete.length} · disputed ${disputed.length}`)
for (const q of flagged) console.log(`   Q${String(q.q_no).padStart(2)} ${q.review_flag}`)
