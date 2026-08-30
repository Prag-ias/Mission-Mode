#!/usr/bin/env node
/** Merges a validate-and-explain workflow result into its question draft. */
import fs from 'node:fs'
const src = process.argv[2]
const r = (JSON.parse(fs.readFileSync(src, 'utf8')).result) ?? {}
const year = r.year
const f = `seed/questions-gs1-${year}.json`
const d = JSON.parse(fs.readFileSync(f, 'utf8'))
const blind = new Map((r.blind ?? []).map((b) => [b.q_no, b]))
const expl = new Map((r.explanations ?? []).map((e) => [e.q_no, e]))

let agree = 0, scored = 0, doubts = 0
const diffs = []
for (const q of d.questions) {
  const b = blind.get(q.q_no)
  if (b) q.independent_answer = { answer: b.answer, confidence: b.confidence, beyond_knowledge: !!b.beyond_knowledge, reasoning: b.reasoning ?? null }
  const e = expl.get(q.q_no)
  if (e) {
    q.explanation_md = e.explanation_md
    q.key_supported = e.key_supported !== false
    if (e.key_supported === false) { q.key_doubt = e.key_doubt; doubts++
      q.review_flag = (q.review_flag ? q.review_flag + ' ' : '') + 'Explanation pass could not verify the key.' }
  }
  if (q.dropped_by_upsc || !q.answer) continue
  scored++
  if (b && b.answer === q.answer) agree++
  else if (b) { diffs.push({ q: q.q_no, key: q.answer, mine: b.answer, conf: b.confidence, beyond: b.beyond_knowledge })
    q.review_flag = (q.review_flag ? q.review_flag + ' ' : '') + `Official key says ${q.answer}, independent reasoning said ${b.answer}.` }
}
d.independent_pass = { done_on: new Date().toISOString().slice(0, 10), note: 'Blind cross-check produced without reading the answer field.' }
d.explanations_generated = { on: new Date().toISOString().slice(0, 10), note: 'Written fresh from subject knowledge (D2).' }
fs.writeFileSync(f, JSON.stringify(d, null, 1))

const pct = scored ? Math.round((agree / scored) * 100) : 0
console.log(`${year}: blind agreement ${agree}/${scored} (${pct}%) · explanations ${d.questions.filter(q=>q.explanation_md).length} · key doubts ${doubts}`)
for (const x of diffs) console.log(`   Q${String(x.q).padStart(3)} key=${x.key} mine=${x.mine} [${x.conf}${x.beyond ? ', beyond cutoff' : ''}]`)
