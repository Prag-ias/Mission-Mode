#!/usr/bin/env node
/**
 * Turns a finished ingest-gs1-paper workflow result into a draft question file.
 * The draft is deliberately unreviewed: answer, answer_source and explanation
 * are left null, and reviewed_by_human is false, so the loader refuses it until
 * a key is attached and a human has looked.
 *
 *   node scripts/collect-paper.mjs <task-output.json> [outfile]
 */
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2]
if (!src) { console.error('usage: node scripts/collect-paper.mjs <task-output.json> [outfile]'); process.exit(1) }

const raw = JSON.parse(fs.readFileSync(src, 'utf8'))
const r = raw.result ?? raw
const qs = r.questions ?? []
const paper = r.paper ?? 'GS1'
const year = r.year

const out = process.argv[3] ?? `seed/questions-${paper.toLowerCase()}-${year}.json`

const draft = {
  paper, year,
  source_pdf: `PYQs/Prelims/${paper === 'GS1' ? 'GS PAPER 1' : 'GS PAPER 2'}/${paper === 'GS1' ? 'GS PAPER 1' : 'GS PAPER 2'} ${year}.pdf`,
  booklet_series: null,
  transcribed_on: new Date().toISOString().slice(0, 10),
  reviewed_by_human: false,
  answer_key: null,
  questions: qs.map((q) => ({
    q_no: q.q_no, page: q.page, stem: q.stem, options: q.options,
    answer: null, answer_source: null, disputed: false, dropped_by_upsc: false,
    format: q.format ?? null, subject_code: q.subject_code ?? null,
    topic_codes: q.topic_codes ?? [], primary_topic_code: q.primary_topic_code ?? null,
    explanation_md: null,
    has_table: !!q.has_table, has_figure: !!q.has_figure,
    tagging_confidence: q.tagging_confidence ?? null, tagging_note: q.tagging_note ?? null,
    transcription_note: q.note ?? null,
  })),
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(draft, null, 1))

const gaps = draft.questions.filter((q) => /GAP:/i.test(q.tagging_note ?? ''))
const verdicts = (r.batches ?? []).map((b) => b.verdict)
const disc = (r.batches ?? []).flatMap((b) => b.discrepancies ?? [])
console.log(`${paper} ${year} -> ${out}`)
console.log(`  ${draft.questions.length} questions · missing [${(r.integrity?.missing ?? []).join(',')}] · dupes [${(r.integrity?.dupes ?? []).join(',')}] · bad options [${(r.integrity?.badOptions ?? []).join(',')}]`)
console.log(`  batch verdicts: ${verdicts.join(', ')} · discrepancies fixed: ${disc.length}`)
for (const d of disc) console.log(`    Q${d.q_no} ${d.field}: ${String(d.issue).slice(0, 120)}`)
console.log(`  low-confidence tags: ${(r.integrity?.lowConfidence ?? []).map((n) => 'Q' + n).join(', ') || 'none'}`)
if (gaps.length) {
  console.log(`  TOPIC-TREE GAPS (${gaps.length}):`)
  for (const g of gaps) console.log(`    Q${g.q_no}: ${g.tagging_note}`)
}
