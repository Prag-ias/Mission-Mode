#!/usr/bin/env node
/**
 * Renders the ENGLISH pages of a UPSC paper to PNGs for transcription.
 *
 * The papers are bilingual scans: even pages Hindi, odd pages English. Only
 * the odd pages are rendered, so half the work never happens (decision D28).
 * Nothing here writes to the database — output is throwaway, gitignored, and
 * regenerable.
 *
 *   node scripts/render-pages.mjs --paper GS1 --year 2026
 *   node scripts/render-pages.mjs --paper GS1 --year 2026 --last 51
 *
 * --last is the final page carrying questions; pages after it are rough work
 * and the cover. Omit it and every odd page to the end is rendered.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const argOf = (k, d = null) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : d
}

const PAPER = (argOf('--paper', 'GS1') || '').toUpperCase()
const YEAR = Number(argOf('--year'))
const FIRST = Number(argOf('--first', '3'))
const LAST = argOf('--last') ? Number(argOf('--last')) : null
const DPI = Number(argOf('--dpi', '150'))

if (!YEAR || !['GS1', 'CSAT'].includes(PAPER)) {
  console.error('usage: node scripts/render-pages.mjs --paper GS1|CSAT --year 2021..2026 [--last N] [--dpi 150]')
  process.exit(1)
}

// CSAT is "GS PAPER 2" on disk
const folder = PAPER === 'GS1' ? 'GS PAPER 1' : 'GS PAPER 2'
const pdf = path.join(root, 'PYQs', 'Prelims', folder, `${folder} ${YEAR}.pdf`)
if (!fs.existsSync(pdf)) {
  console.error(`not found: ${pdf}`)
  process.exit(1)
}

const outDir = path.join(root, '.ingest', 'pages', `${PAPER.toLowerCase()}_${YEAR}`)
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

// pdftoppm has no "odd pages only" flag, so render them one at a time.
const pageCount = (() => {
  try {
    const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' })
    return Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0)
  } catch {
    return 0
  }
})()

const end = LAST ?? (pageCount || 60)
const pages = []
for (let p = FIRST; p <= end; p += 2) pages.push(p)

for (const p of pages) {
  execFileSync('pdftoppm', ['-f', String(p), '-l', String(p), '-r', String(DPI), '-png', pdf, path.join(outDir, 'p')], {
    stdio: ['ignore', 'ignore', 'ignore'],
  })
}

const written = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'))
console.log(`${PAPER} ${YEAR} — rendered ${written.length} English pages (${FIRST}..${end} odd) at ${DPI}dpi`)
console.log(`  ${outDir}`)
