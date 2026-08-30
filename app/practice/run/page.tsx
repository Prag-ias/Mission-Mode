import { redirect } from 'next/navigation'
import { and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'

import { isAuthed } from '@/lib/auth'
import { filterQuery, parseFilters } from '@/lib/practice'
import PracticeRunner from '@/components/PracticeRunner'

export const dynamic = 'force-dynamic'

export default async function Run({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isAuthed())) redirect('/')
  const sp = await searchParams
  const f = parseFilters(sp)

  const where = [sql`1=1`]
  if (f.subject) where.push(sql`q.subject_id = (select id from subjects where code = ${f.subject})`)
  if (f.year) where.push(sql`q.year = ${f.year}`)
  if (f.format) where.push(sql`q.format = ${f.format}`)
  if (f.disputed) where.push(sql`q.disputed = true`)
  if (f.wrong) where.push(sql`exists (select 1 from attempts a where a.question_id = q.id and a.is_correct = false)`)

  // Deterministic order from the seed, so walking the batch never reshuffles it.
  const rows = await db.execute(sql`
    select q.id, q.year, q.q_no, q.stem, q.options, q.answer, q.explanation_md,
           q.format, q.disputed, s.name as subject_name, s.colour as subject_colour,
           t.code as topic_code, t.name as topic_name
    from questions q
    left join subjects s on s.id = q.subject_id
    left join question_topics qt on qt.question_id = q.id and qt.primary = true
    left join topics t on t.id = qt.topic_id
    where ${and(...where)}
    order by md5(q.id::text || ${f.seed})
    limit ${f.n}
  `)

  const batch = (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    year: Number(r.year),
    qNo: Number(r.q_no),
    stem: String(r.stem),
    options: r.options as string[],
    answer: String(r.answer ?? ''),
    explanation: (r.explanation_md as string) ?? '',
    format: String(r.format ?? ''),
    disputed: Boolean(r.disputed),
    subjectName: (r.subject_name as string) ?? null,
    subjectColour: (r.subject_colour as string) ?? null,
    topicCode: (r.topic_code as string) ?? null,
    topicName: (r.topic_name as string) ?? null,
  }))

  if (batch.length === 0) redirect('/practice')

  return <PracticeRunner batch={batch} backHref={`/practice/run?${filterQuery(f).toString()}`} seed={f.seed} />
}
