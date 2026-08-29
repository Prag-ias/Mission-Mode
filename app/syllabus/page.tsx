import Link from 'next/link'
import { redirect } from 'next/navigation'
import { asc, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notes, subjects, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { STAGE_BG, type Stage } from '@/lib/stages'

export const dynamic = 'force-dynamic'

const LEGEND: { stage: Stage; label: string }[] = [
  { stage: 'unread', label: 'unread' },
  { stage: 'reading', label: 'reading' },
  { stage: 'read', label: 'read' },
  { stage: 'R2', label: 'R1–R4' },
]

export default async function Syllabus({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  if (!(await isAuthed())) redirect('/')
  const q = ((await searchParams).q ?? '').trim()

  const rows = await db
    .select({
      code: topics.code,
      name: topics.name,
      stage: topics.stage,
      subjectId: topics.subjectId,
      subjectName: subjects.name,
      colour: subjects.colour,
    })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .orderBy(asc(topics.subjectId), asc(topics.code))

  const groups: { name: string; colour: string | null; topics: typeof rows }[] = []
  for (const r of rows) {
    const g = groups[groups.length - 1]
    if (g && g.name === r.subjectName) g.topics.push(r)
    else groups.push({ name: r.subjectName, colour: r.colour, topics: [r] })
  }

  const results = q.length >= 2 ? await search(q) : null

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-5">
      <header className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Syllabus</h1>
        <Link href="/" className="text-sm text-neutral-500 underline">
          Today
        </Link>
      </header>

      <form method="GET" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search notes"
          placeholder="Search notes"
          className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-neutral-900"
        />
      </form>

      {results && (
        <section className="mb-5">
          <p className="mb-2 text-sm text-neutral-500">
            {results.length === 0 ? `Nothing for “${q}”` : `${results.length} for “${q}”`}
          </p>
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <Link
                key={r.code}
                href={`/topic/${r.code}`}
                data-testid={`result-${r.code}`}
                className="rounded-xl border border-neutral-200 bg-white p-3"
              >
                <span className="flex items-center gap-2 text-sm text-neutral-500">
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: r.colour ?? '#a3a3a3' }}
                  />
                  {r.subjectName}
                </span>
                <span className="mt-0.5 block font-medium">{r.name}</span>
                {r.snippet && <span className="mt-0.5 block text-sm text-neutral-500">{r.snippet}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded ${STAGE_BG[l.stage]}`} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((g) => {
          const touched = g.topics.filter((t) => t.stage !== 'unread').length
          return (
            <section key={g.name}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: g.colour ?? '#a3a3a3' }}
                  />
                  {g.name}
                </h2>
                <span className="text-xs tabular-nums text-neutral-500">
                  {touched}/{g.topics.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.topics.map((t) => (
                  <Link
                    key={t.code}
                    href={`/topic/${t.code}`}
                    data-testid={`cell-${t.code}`}
                    data-stage={t.stage}
                    aria-label={t.name}
                    title={t.name}
                    className={`size-8 rounded-md ${STAGE_BG[(t.stage as Stage) ?? 'unread'] ?? 'bg-neutral-200'}`}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}

async function search(q: string) {
  const like = `%${q}%`
  const rows = await db
    .selectDistinctOn([topics.code], {
      code: topics.code,
      name: topics.name,
      subjectName: subjects.name,
      colour: subjects.colour,
      body: notes.bodyMd,
    })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .leftJoin(notes, eq(notes.topicId, topics.id))
    .where(or(ilike(notes.bodyMd, like), ilike(topics.name, like)))
    .orderBy(asc(topics.code))
    .limit(20)

  return rows.map((r) => {
    let snippet: string | null = null
    if (r.body) {
      const i = r.body.toLowerCase().indexOf(q.toLowerCase())
      if (i >= 0) {
        const from = Math.max(0, i - 40)
        snippet =
          (from > 0 ? '…' : '') +
          r.body.slice(from, i + q.length + 60).replace(/\s+/g, ' ') +
          (i + q.length + 60 < r.body.length ? '…' : '')
      }
    }
    return { code: r.code, name: r.name, subjectName: r.subjectName, colour: r.colour, snippet }
  })
}
