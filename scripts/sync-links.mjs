#!/usr/bin/env node
/**
 * Syncs curated reference links into topic_materials (source='sheet').
 *
 *   node scripts/sync-links.mjs                     ← pulls the Google Sheet
 *   node scripts/sync-links.mjs --file seed/topic-links.json
 *
 * Sheet rows are replaced wholesale; rows the user added in the app
 * (source='user') are never touched. The sheet needs three columns with a
 * header row: code, title, url. Extra columns are ignored.
 */
import fs from 'node:fs'
import { config } from 'dotenv'
config({ path: '.env.local' })
const postgres = (await import('postgres')).default

const SHEET_ID = '1js5o_VC_XzccYnCka9vR3egspPQ7UEAdgk9END_Pgco'
const SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`

function parseCsv(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

async function loadRows() {
  const fileFlag = process.argv.indexOf('--file')
  if (fileFlag !== -1) {
    const data = JSON.parse(fs.readFileSync(process.argv[fileFlag + 1], 'utf8'))
    return data.links ?? data
  }
  const res = await fetch(SHEET_CSV, { redirect: 'follow' })
  if (!res.ok) throw new Error(`sheet fetch failed: ${res.status} — is the sheet still link-viewable?`)
  const rows = parseCsv(await res.text())
  if (rows.length === 0) {
    console.log('sheet is empty — nothing to sync (existing sheet rows kept)')
    process.exit(0)
  }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const ci = header.indexOf('code'), ti = header.indexOf('title'), ui = header.indexOf('url')
  if (ci === -1 || ui === -1) throw new Error(`sheet needs 'code' and 'url' header columns, got: ${header.join(', ')}`)
  return rows.slice(1).map((r) => ({
    code: (r[ci] ?? '').trim(),
    title: (ti === -1 ? '' : (r[ti] ?? '').trim()) || 'Reference',
    url: (r[ui] ?? '').trim(),
  }))
}

const rows = await loadRows()
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: 'require' })
const topicId = new Map((await sql`select id, code from topics`).map((t) => [t.code, t.id]))

const good = [], bad = []
for (const r of rows) {
  if (!topicId.has(r.code)) { bad.push(`${r.code || '(no code)'} — unknown topic code`); continue }
  if (!/^https?:\/\/\S+$/.test(r.url)) { bad.push(`${r.code} — bad url: ${r.url || '(empty)'}`); continue }
  good.push({ topic_id: topicId.get(r.code), kind: 'link', source: 'sheet', title: r.title.slice(0, 200), url: r.url })
}

await sql.begin(async (tx) => {
  await tx`delete from topic_materials where source = 'sheet'`
  for (let i = 0; i < good.length; i += 100) {
    await tx`insert into topic_materials ${tx(good.slice(i, i + 100), 'topic_id', 'kind', 'source', 'title', 'url')}`
  }
})

console.log(`synced ${good.length} reference links across ${new Set(good.map((g) => g.topic_id)).size} topics`)
if (bad.length) {
  console.log(`skipped ${bad.length}:`)
  for (const b of bad) console.log('  ' + b)
}
await sql.end()
