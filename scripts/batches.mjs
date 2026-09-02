#!/usr/bin/env node
/** Prints the Workflow args for one paper, with page batches derived from what
 *  was actually rendered — page counts differ by year, so they cannot be
 *  hardcoded. Usage: node scripts/batches.mjs GS1 2019 [nBatches] */
import fs from 'node:fs'
import path from 'node:path'

const [paperArg, year, n = '4'] = process.argv.slice(2)
if (!paperArg || !year) {
  console.error('usage: node scripts/batches.mjs GS1|CSAT <year> [nBatches]')
  process.exit(1)
}
const paper = paperArg.toUpperCase()
const isCsat = paper === 'CSAT'
const root = path.resolve(import.meta.dirname, '..')
const posix = root.split(path.sep).join('/')

const dir = path.join(root, '.ingest', 'pages', `${isCsat ? 'csat' : 'gs1'}_${year}`)
if (!fs.existsSync(dir)) {
  console.error('NOT RENDERED: ' + dir)
  process.exit(1)
}
const pages = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .map((f) => Number(f.replace(/[^0-9]/g, '')))
  .sort((a, b) => a - b)

const per = Math.ceil(pages.length / Number(n))
const batches = []
for (let i = 0; i < pages.length; i += per) batches.push(pages.slice(i, i + per))

const folder = isCsat ? 'GS PAPER 2' : 'GS PAPER 1'
const label = isCsat ? 'GS Paper 2' : 'GS Paper 1'
const keyFile =
  Number(year) === 2026
    ? `${posix}/PYQs/Prelims/${folder}/2026 ${label} Answer Key.pdf`
    : `${posix}/PYQs/Prelims/${folder}/${label} Answer Key ${year}.png`

if (!fs.existsSync(keyFile)) {
  console.error('MISSING KEY: ' + keyFile)
  process.exit(1)
}

console.log(JSON.stringify({ paper, year: Number(year), keyFile, batches }))
