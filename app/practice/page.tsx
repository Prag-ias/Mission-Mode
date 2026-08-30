import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { attempts, questions, subjects } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { filterQuery, parseFilters } from '@/lib/practice'

export const dynamic = 'force-dynamic'

const FORMATS = [
  ['', 'any format'],
  ['stmt_1_2_3', 'statements'],
  ['simple', 'simple'],
  ['pairs', 'how many correct'],
  ['stmt_1_2', 'two statements'],
  ['relationship', 'relationship (2026)'],
  ['conclusion_count', 'conclusions (2026)'],
  ['case_study', 'case study (2026)'],
  ['assertion_basis', 'assertion & basis'],
  ['match_list', 'match list'],
  ['identify', 'identify'],
] as const

export default async function Practice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isAuthed())) redirect('/')
  const sp = await searchParams
  const f = parseFilters(sp)

  const where = [sql`1=1`]
  if (f.subject) where.push(sql`${questions.subjectId} = (select id from subjects where code = ${f.subject})`)
  if (f.year) where.push(sql`${questions.year} = ${f.year}`)
  if (f.format) where.push(sql`${questions.format} = ${f.format}`)
  if (f.disputed) where.push(sql`${questions.disputed} = true`)
  if (f.wrong)
    where.push(sql`exists (select 1 from ${attempts} a where a.question_id = ${questions.id} and a.is_correct = false)`)

  const [[pool], subjectRows, years, [done]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(questions).where(and(...where)),
    db
      .select({ code: subjects.code, name: subjects.name, colour: subjects.colour, n: sql<number>`count(${questions.id})` })
      .from(subjects)
      .leftJoin(questions, eq(questions.subjectId, subjects.id))
      .groupBy(subjects.code, subjects.name, subjects.colour)
      .having(sql`count(${questions.id}) > 0`)
      .orderBy(sql`count(${questions.id}) desc`),
    db.select({ year: questions.year, n: sql<number>`count(*)` }).from(questions).groupBy(questions.year).orderBy(questions.year),
    db.select({ n: sql<number>`count(*)` }).from(attempts),
  ])

  const poolSize = Number(pool?.n ?? 0)
  const runHref = `/practice/run?${filterQuery(f).toString()}`

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-2 text-sm transition ${
      active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-muted'
    }`

  const link = (patch: Record<string, string | undefined>) => {
    const p = filterQuery(f)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') p.delete(k)
      else p.set(k, v)
    }
    return `/practice?${p.toString()}`
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5 sm:px-6 lg:pt-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight lg:text-4xl">Practice</h1>

      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:gap-8">
        <div className="flex flex-col gap-5">
          <section>
            <p className="mono-label mb-2 text-muted">subject</p>
            <div className="flex flex-wrap gap-2">
              <Link href={link({ subject: undefined })} className={chip(!f.subject)}>
                all
              </Link>
              {subjectRows.map((s) => (
                <Link key={s.code} href={link({ subject: s.code })} className={chip(f.subject === s.code)}>
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block size-2 rounded-full align-middle"
                    style={{ backgroundColor: s.colour ?? '#a3a3a3' }}
                  />
                  {s.code} <span className="font-mono text-xs opacity-60">{Number(s.n)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <p className="mono-label mb-2 text-muted">year</p>
            <div className="flex flex-wrap gap-2">
              <Link href={link({ year: undefined })} className={chip(!f.year)}>
                all
              </Link>
              {years.map((y) => (
                <Link key={y.year} href={link({ year: String(y.year) })} className={chip(f.year === y.year)}>
                  {y.year} <span className="font-mono text-xs opacity-60">{Number(y.n)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <p className="mono-label mb-2 text-muted">format</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(([v, label]) => (
                <Link key={v || 'any'} href={link({ format: v || undefined })} className={chip((f.format ?? '') === v)}>
                  {label}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <p className="mono-label mb-2 text-muted">only</p>
            <div className="flex flex-wrap gap-2">
              <Link href={link({ wrong: f.wrong ? undefined : '1' })} className={chip(!!f.wrong)}>
                previously wrong
              </Link>
              <Link href={link({ disputed: f.disputed ? undefined : '1' })} className={chip(!!f.disputed)}>
                disputed
              </Link>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-5 shadow-s">
            <p className="mono-label text-muted">questions matching</p>
            <p data-testid="pool-size" className="font-mono text-4xl font-bold tabular-nums">
              {poolSize}
            </p>

            <p className="mono-label mb-2 mt-5 text-muted">batch size</p>
            <div className="flex gap-2">
              {[10, 20].map((n) => (
                <Link key={n} href={link({ n: String(n) })} className={`${chip(f.n === n)} flex-1 text-center font-mono`}>
                  {n}
                </Link>
              ))}
            </div>

            {poolSize === 0 ? (
              <p className="mt-5 text-sm text-muted">Nothing matches. Loosen a filter.</p>
            ) : (
              <Link
                href={runHref}
                className="mt-5 flex h-14 w-full items-center justify-center rounded-btn bg-accent text-lg font-semibold text-white transition active:bg-accent-deep lg:hover:bg-accent-deep"
              >
                Start
              </Link>
            )}
            <p className="mt-3 font-mono text-xs text-muted">{Number(done?.n ?? 0)} attempts logged</p>
          </div>
        </aside>
      </div>
    </main>
  )
}
