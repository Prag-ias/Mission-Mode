#!/usr/bin/env node
/**
 * Marks an ingested question file as human-reviewed so the loader accepts it.
 * The note is mandatory and is stored verbatim: it is the record of what was
 * actually checked, and a future reader has nothing else to go on.
 *
 *   node scripts/mark-reviewed.mjs seed/questions-gs1-2014.json "checked ..."
 */
import fs from 'node:fs'

const [file, note] = process.argv.slice(2)
if (!file || !note) {
  console.error('usage: node scripts/mark-reviewed.mjs <file> "<review note>"')
  process.exit(1)
}
const d = JSON.parse(fs.readFileSync(file, 'utf8'))
d.reviewed_by_human = true
d.reviewed_on = new Date().toISOString().slice(0, 10)
d.review_note = note
fs.writeFileSync(file, JSON.stringify(d, null, 1))
console.log(`${file} — marked reviewed on ${d.reviewed_on}`)
