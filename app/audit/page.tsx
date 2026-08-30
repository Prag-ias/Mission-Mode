import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, eq, isNull, lt, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { attempts, planBlocks, revisionEvents, subjects, tests, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { addDaysISO, todayIST } from '@/lib/dates'
import { CARRY_DAYS, QUEUE_CAP } from '@/lib/ladder'

export const dynamic = 'force-dynamic'

const PLAN_START = '2026-08-31'
const TARGET = 120
const CUTOFF = 92.66

/** Freshness decays with days since touch, slower the higher the ladder stage. */
const STAGE_WEIGHT: Record<string, number> = { read: 1, R1: 2, R2: 3, R3: 4, R4: 6, mains: 8 }
function freshness(stage: string, lastTouched: Date | null): number | null {
  const w = STAGE_WEIGHT[stage]
  if (!w) return null
  const days = lastTouched ? (Date.now() - lastTouched.getTime()) / 86_400_000 : 90
  return Math.max(0, Math.round(100 - (days * 12) / w))
}

const REASONS: Record<number, string> = {
  1: 'didn’t know', 2: 'knew, forgot', 3: 'misread', 4: 'confused two', 5: 'bad guess', 6: 'out of time',
}

export default async function Audit() {
  if (!(await isAuthed())) redirect('/')
  const today = todayIST()

  // Sequential on purpose — a wide Promise.all over the pool is the exact
  // shape that wedged export and this page; the whole read is ~300ms anyway.
  const adh = await db
        .select({
          total: sql<number>`count(*)`,
          done: sql<number>`count(*) filter (where ${planBlocks.status} = 'done')`,
          skipped: sql<number>`count(*) filter (where ${planBlocks.status} = 'skipped')`,
          minutes: sql<number>`coalesce(sum(${planBlocks.actualMinutes}) filter (where ${planBlocks.status} = 'done'), 0)`,
        })
        .from(planBlocks)
        .where(and(sql`${planBlocks.date} >= ${PLAN_START}`, lt(planBlocks.date, today)))
  const stageRows = await db
        .select({ stage: topics.stage, n: sql<number>`count(*)` })
        .from(topics)
        .where(eq(topics.bonus, false))
        .groupBy(topics.stage)
  const [dueRow] = await db
        .select({ n: sql<number>`count(*)` })
        .from(revisionEvents)
        .where(and(lte(revisionEvents.dueOn, today), isNull(revisionEvents.completedAt)))
  const blockDebtRows = await db
        .select({ n: sql<number>`count(*)` })
        .from(planBlocks)
        .where(and(eq(planBlocks.status, 'rescheduled'), lt(planBlocks.date, addDaysISO(today, -CARRY_DAYS))))
  const mockRows = await db.select().from(tests).orderBy(asc(tests.date), asc(tests.id))
  const reasonRows = await db
        .select({ code: attempts.reasonCode, n: sql<number>`count(*)` })
        .from(attempts)
        .where(sql`${attempts.reasonCode} is not null`)
        .groupBy(attempts.reasonCode)
  const decayTopicRows = await db
        .select({ subject: subjects.code, colour: subjects.colour, stage: topics.stage, touched: topics.lastTouchedAt })
        .from(topics)
        .innerJoin(subjects, eq(topics.subjectId, subjects.id))
        .where(and(eq(topics.bonus, false), sql`${topics.stage} not in ('unread', 'reading')`))

  const a = adh[0]
  const scheduled = Number(a?.total ?? 0)
  const doneN = Number(a?.done ?? 0)
  const adherence = scheduled ? Math.round((doneN / scheduled) * 100) : null

  const stageOf = (s: string) => Number(stageRows.find((r) => r.stage === s)?.n ?? 0)
  const coreTotal = stageRows.reduce((s, r) => s + Number(r.n), 0)
  const touched = coreTotal - stageOf('unread')
  const ladder = coreTotal - stageOf('unread') - stageOf('reading') - stageOf('read')

  const queueDebt = Math.max(0, Number(dueRow?.n ?? 0) - QUEUE_CAP)
  const blockDebt = Number(blockDebtRows[0]?.n ?? 0)

  const scores = mockRows.map((m) => Number(m.score ?? 0))
  const rolling3 = scores.length ? Math.round((scores.slice(-3).reduce((s, x) => s + x, 0) / Math.min(3, scores.length)) * 10) / 10 : null

  // decay meter per subject
  const decayBySubject = new Map<string, { colour: string | null; vals: number[] }>()
  for (const r of decayTopicRows) {
    const f = freshness(r.stage, r.touched)
    if (f === null) continue
    const e = decayBySubject.get(r.subject) ?? { colour: r.colour, vals: [] }
    e.vals.push(f)
    decayBySubject.set(r.subject, e)
  }
  const decay = [...decayBySubject.entries()]
    .map(([code, e]) => ({ code, colour: e.colour, f: Math.round(e.vals.reduce((s, x) => s + x, 0) / e.vals.length) }))
    .sort((x, y) => x.f - y.f)

  const totalReasons = reasonRows.reduce((s, r) => s + Number(r.n), 0)

  // mock chart geometry (0–200 score range, fixed viewbox)
  const W = 560, H = 120, PAD = 6
  const y = (score: number) => H - PAD - (score / 200) * (H - PAD * 2)
  const x = (i: number) => (mockRows.length <= 1 ? W / 2 : PAD + (i / (mockRows.length - 1)) * (W - PAD * 2))
  const path = mockRows.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(Number(m.score ?? 0)).toFixed(1)}`).join(' ')

  const card = 'rounded-card border border-line bg-surface p-4 shadow-s'
  const big = 'font-mono text-3xl font-bold tabular-nums'

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-5 sm:px-6 lg:max-w-6xl lg:px-8 lg:pt-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-muted">sunday · the honest numbers</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight lg:text-4xl">Audit</h1>
        </div>
        <nav className="flex gap-2">
          <Link href="/tests/new" className="flex h-11 items-center rounded-btn bg-accent px-4 font-semibold text-white active:bg-accent-deep lg:hover:bg-accent-deep">
            Enter mock
          </Link>
          <Link href="/ca" className="flex h-11 items-center rounded-btn border border-line bg-surface px-4 font-medium active:bg-bg lg:hover:border-muted">
            Capture CA
          </Link>
          <a href="/api/export" className="flex h-11 items-center rounded-btn border border-line bg-surface px-4 font-medium active:bg-bg lg:hover:border-muted">
            Export
          </a>
        </nav>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <section data-testid="audit-adherence" className={`${card} lg:col-span-3`}>
          <p className="mono-label text-muted">block adherence</p>
          <p className={`${big} mt-1`}>{adherence === null ? '—' : `${adherence}%`}</p>
          <p className="mt-1 text-xs text-muted">
            {doneN}/{scheduled} blocks since 31 Aug · {a?.skipped ?? 0} skipped · {Math.round(Number(a?.minutes ?? 0) / 60)} h logged
          </p>
          <p className="mt-2 text-xs text-muted">Weekly floor: 85%.</p>
        </section>

        <section data-testid="audit-coverage" className={`${card} lg:col-span-3`}>
          <p className="mono-label text-muted">coverage</p>
          <p className={`${big} mt-1`}>
            {touched}
            <span className="text-muted">/{coreTotal}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            topics touched · {stageOf('read')} read · {ladder} on the ladder
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${coreTotal ? (touched / coreTotal) * 100 : 0}%` }} />
          </div>
        </section>

        <section data-testid="audit-debt" className={`${card} lg:col-span-3`}>
          <p className="mono-label text-muted">debt</p>
          <p className={`${big} mt-1 ${queueDebt + blockDebt > 15 ? 'text-accent-deep' : ''}`}>{queueDebt + blockDebt}</p>
          <p className="mt-1 text-xs text-muted">
            {queueDebt} revision overflow · {blockDebt} owed blocks
          </p>
          <p className="mt-2 text-xs text-muted">Keep under 15.</p>
        </section>

        <section className={`${card} lg:col-span-3`}>
          <p className="mono-label text-muted">rolling 3-mock avg</p>
          <p className={`${big} mt-1 ${rolling3 !== null && rolling3 < CUTOFF ? 'text-accent-deep' : ''}`}>
            {rolling3 ?? '—'}
          </p>
          <p className="mt-1 text-xs text-muted">{mockRows.length} mocks entered</p>
        </section>

        <section data-testid="audit-mocks" className={`${card} lg:col-span-7`}>
          <div className="flex items-baseline justify-between">
            <p className="mono-label text-muted">mock scores</p>
            <p className="font-mono text-xs text-muted">
              target {TARGET} · cut-off {CUTOFF}
            </p>
          </div>
          {mockRows.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              No mocks yet. <Link href="/tests/new" className="text-accent-deep underline">Enter the first one</Link> — the
              rolling average against {TARGET} starts there.
            </p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Mock scores over time">
              <line x1={0} x2={W} y1={y(TARGET)} y2={y(TARGET)} stroke="var(--dusk-deep)" strokeDasharray="5 4" strokeWidth="1.4" />
              <line x1={0} x2={W} y1={y(CUTOFF)} y2={y(CUTOFF)} stroke="var(--accent)" strokeDasharray="3 4" strokeWidth="1.2" />
              {mockRows.length > 1 && <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" />}
              {mockRows.map((m, i) => (
                <circle key={m.id} cx={x(i)} cy={y(Number(m.score ?? 0))} r="3.4" fill="var(--ink)" />
              ))}
            </svg>
          )}
        </section>

        <section data-testid="audit-reasons" className={`${card} lg:col-span-5`}>
          <p className="mono-label text-muted">why answers go wrong</p>
          {totalReasons === 0 ? (
            <p className="mt-4 text-sm text-muted">No coded mistakes yet — they come from practice batches.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {[1, 2, 3, 4, 5, 6].map((code) => {
                const n = Number(reasonRows.find((r) => Number(r.code) === code)?.n ?? 0)
                const pct = totalReasons ? Math.round((n / totalReasons) * 100) : 0
                return (
                  <div key={code} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-muted">{REASONS[code]}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: code === 3 && pct > 15 ? 'var(--accent)' : 'var(--night-deep)',
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-xs tabular-nums">{pct}%</span>
                  </div>
                )
              })}
              <p className="mt-1 text-xs text-muted">Misread above 15% is a reading problem, not a syllabus problem.</p>
            </div>
          )}
        </section>

        <section data-testid="audit-decay" className={`${card} lg:col-span-12`}>
          <p className="mono-label text-muted">freshness by subject · 100 = just touched</p>
          {decay.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing on the ladder yet — freshness starts once topics reach read.</p>
          ) : (
            <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {decay.map((d) => (
                <div key={d.code} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: d.colour ?? '#a3a3a3' }} />
                  <span className="w-12 shrink-0">{d.code}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.f}%`,
                        backgroundColor: d.f < 40 ? 'var(--accent)' : d.f < 70 ? 'var(--day-deep)' : 'var(--dawn-deep)',
                      }}
                    />
                  </div>
                  <span className="w-9 text-right font-mono text-xs font-bold tabular-nums">{d.f}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
