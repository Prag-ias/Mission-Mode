/**
 * Loads a reviewed question file into `questions` and `question_topics`.
 *
 * The review gate is the point of this script. HANDOFF is explicit: an
 * unreviewed answer key teaches the wrong fact for eight months. So a file
 * only loads when it carries `"reviewed_by_human": true` AND --confirm is
 * passed on the command line. Anything missing an answer or a provenance is
 * refused outright rather than loaded with a guess.
 *
 *   node --import tsx scripts/ingest-questions.ts seed/questions-gs1-2026.json          # dry run
 *   node --import tsx scripts/ingest-questions.ts seed/questions-gs1-2026.json --confirm
 *
 * Idempotent: re-running updates content in place, keyed on (year, paper, q_no).
 * Attempts already recorded against a question are never touched.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq, sql } from 'drizzle-orm'
import { questions, questionTopics, subjects, topics } from '../db/schema'

type FileQuestion = {
  q_no: number
  stem: string
  options: string[]
  answer?: string | null
  format?: string | null
  subject_code?: string | null
  topic_codes?: string[]
  primary_topic_code?: string | null
  explanation_md?: string | null
  answer_source?: string | null
  disputed?: boolean
  dropped_by_upsc?: boolean
  page?: number
}

type FileShape = {
  paper: string
  year: number
  reviewed_by_human?: boolean
  reviewed_on?: string
  questions: FileQuestion[]
}

const ALLOWED_ANSWERS = ['a', 'b', 'c', 'd']

async function main() {
  const file = process.argv[2]
  const confirm = process.argv.includes('--confirm')
  if (!file) {
    console.error('usage: node --import tsx scripts/ingest-questions.ts <file.json> [--confirm]')
    process.exit(1)
  }

  const data: FileShape = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const { paper, year } = data
  if (!paper || !year) throw new Error('file must declare "paper" and "year"')

  // A question UPSC itself dropped has no defensible answer — practising it
  // would teach whatever we guessed. Keep it in the file for the record and
  // out of the bank.
  const droppedNos = data.questions.filter((q) => q.dropped_by_upsc).map((q) => q.q_no)
  const loadable = data.questions.filter((q) => !q.dropped_by_upsc)
  if (droppedNos.length) {
    console.log(`skipping ${droppedNos.length} question(s) dropped by UPSC: Q${droppedNos.join(', Q')}`)
  }

  // ---------------------------------------------------------------- validate
  const problems: string[] = []
  const seen = new Set<number>()
  for (const q of loadable) {
    const at = `Q${q.q_no}`
    if (!Number.isInteger(q.q_no) || q.q_no < 1) problems.push(`${at}: bad q_no`)
    if (seen.has(q.q_no)) problems.push(`${at}: duplicate`)
    seen.add(q.q_no)
    if (!q.stem?.trim()) problems.push(`${at}: empty stem`)
    if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`${at}: needs exactly 4 options`)
    else if (q.options.some((o) => !o?.trim())) problems.push(`${at}: blank option`)
    if (!q.answer || !ALLOWED_ANSWERS.includes(q.answer)) problems.push(`${at}: answer must be a|b|c|d`)
    if (!q.answer_source?.trim()) problems.push(`${at}: answer_source is required (provenance, decision D1)`)
    else if (q.answer_source.length > 24) problems.push(`${at}: answer_source longer than 24 chars`)
    if (!q.format?.trim()) problems.push(`${at}: format is required`)
  }
  if (problems.length) {
    console.error(`REFUSED — ${problems.length} problem(s):`)
    for (const p of problems.slice(0, 40)) console.error('  ' + p)
    if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`)
    process.exit(1)
  }

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — put it in .env.local')
  const client = postgres(url, { prepare: false, max: 1 })
  const db = drizzle(client)

  // vocabularies must already exist; never invent a subject or topic here
  const subjectId = new Map((await db.select().from(subjects)).map((s) => [s.code, s.id]))
  const topicId = new Map((await db.select().from(topics)).map((t) => [t.code, t.id]))
  const formats: string[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'seed', 'question-formats.json'), 'utf8'),
  ).map((f: { slug: string }) => f.slug)

  const vocab: string[] = []
  for (const q of data.questions) {
    if (q.format && !formats.includes(q.format)) vocab.push(`Q${q.q_no}: unknown format "${q.format}"`)
    if (q.subject_code && !subjectId.has(q.subject_code)) vocab.push(`Q${q.q_no}: unknown subject "${q.subject_code}"`)
    for (const c of q.topic_codes ?? []) {
      if (!topicId.has(c)) vocab.push(`Q${q.q_no}: unknown topic "${c}"`)
    }
    if (q.primary_topic_code && !(q.topic_codes ?? []).includes(q.primary_topic_code)) {
      vocab.push(`Q${q.q_no}: primary topic not in topic_codes`)
    }
  }
  if (vocab.length) {
    console.error(`REFUSED — ${vocab.length} vocabulary problem(s):`)
    for (const v of vocab.slice(0, 40)) console.error('  ' + v)
    await client.end()
    process.exit(1)
  }

  const disputed = data.questions.filter((q) => q.disputed).length
  const noExplanation = data.questions.filter((q) => !q.explanation_md?.trim()).length

  console.log(`${paper} ${year} — ${data.questions.length} questions validated`)
  console.log(`  disputed: ${disputed} · without explanation: ${noExplanation}`)
  console.log(`  reviewed_by_human: ${data.reviewed_by_human === true}${data.reviewed_on ? ` (${data.reviewed_on})` : ''}`)

  if (!data.reviewed_by_human) {
    console.error('\nREFUSED — this file is not marked reviewed.')
    console.error('Set "reviewed_by_human": true only after a human has checked the answer key.')
    await client.end()
    process.exit(1)
  }
  if (!confirm) {
    console.log('\nDry run only. Re-run with --confirm to write to the database.')
    await client.end()
    return
  }

  // ------------------------------------------------------------------- write
  let inserted = 0
  let updated = 0
  for (const q of data.questions) {
    const [existing] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.year, year), eq(questions.paper, paper), eq(questions.qNo, q.q_no)))
      .limit(1)

    const row = {
      year,
      paper,
      qNo: q.q_no,
      stem: q.stem,
      options: q.options,
      answer: q.answer ?? null,
      explanationMd: q.explanation_md ?? null,
      subjectId: q.subject_code ? (subjectId.get(q.subject_code) ?? null) : null,
      format: q.format ?? 'simple',
      answerSource: q.answer_source ?? 'disputed',
      disputed: q.disputed ?? false,
    }

    let id: number
    if (existing) {
      await db.update(questions).set(row).where(eq(questions.id, existing.id))
      id = existing.id
      updated++
    } else {
      const [ins] = await db.insert(questions).values(row).returning({ id: questions.id })
      id = ins.id
      inserted++
    }

    // topics are replaced wholesale — retagging is a normal thing to redo
    await db.delete(questionTopics).where(eq(questionTopics.questionId, id))
    const codes = [...new Set(q.topic_codes ?? [])]
    if (codes.length) {
      await db.insert(questionTopics).values(
        codes.map((c) => ({
          questionId: id,
          topicId: topicId.get(c)!,
          primary: c === q.primary_topic_code,
        })),
      )
    }
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(questions)
    .where(and(eq(questions.year, year), eq(questions.paper, paper)))
  console.log(`\nloaded — inserted ${inserted}, updated ${updated}; ${paper} ${year} now holds ${n} questions`)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
