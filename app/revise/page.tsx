import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, asc, eq, isNull, lt, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { planBlocks, revisionEvents, subjects, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { addDaysISO, daysBetween, displayDateShort, todayIST } from '@/lib/dates'
import { CARRY_DAYS, QUEUE_CAP } from '@/lib/ladder'
import { sweepMissedBlocks } from '@/lib/sweep'
import { completeEvent, skipBlock } from '@/app/actions'
import BlockCard from '@/components/BlockCard'

export const dynamic = 'force-dynamic'

export default async function Revise() {
  if (!(await isAuthed())) redirect('/')
  await sweepMissedBlocks()
  const today = todayIST()

  const dueWhere = and(lte(revisionEvents.dueOn, today), isNull(revisionEvents.completedAt))

  const [items, [{ due }], blockDebt] = await Promise.all([
    db
      .select({
        id: revisionEvents.id,
        rung: revisionEvents.rung,
        dueOn: revisionEvents.dueOn,
        code: topics.code,
        name: topics.name,
        colour: subjects.colour,
      })
      .from(revisionEvents)
      .innerJoin(topics, eq(revisionEvents.topicId, topics.id))
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(dueWhere)
      .orderBy(asc(revisionEvents.dueOn), asc(topics.code))
      .limit(QUEUE_CAP),
    db.select({ due: sql<number>`count(*)` }).from(revisionEvents).where(dueWhere),
    db
      .select({
        id: planBlocks.id,
        slot: planBlocks.slot,
        date: planBlocks.date,
        start: planBlocks.start,
        label: planBlocks.label,
        sourceRef: planBlocks.sourceRef,
        plannedMinutes: planBlocks.plannedMinutes,
        actualMinutes: planBlocks.actualMinutes,
        status: planBlocks.status,
        kind: planBlocks.kind,
        colour: subjects.colour,
        topicCode: topics.code,
      })
      .from(planBlocks)
      .leftJoin(subjects, eq(planBlocks.subjectId, subjects.id))
      .leftJoin(topics, eq(planBlocks.topicId, topics.id))
      .where(and(eq(planBlocks.status, 'rescheduled'), lt(planBlocks.date, addDaysISO(today, -CARRY_DAYS))))
      .orderBy(asc(planBlocks.date), asc(planBlocks.start)),
  ])

  const debt = Math.max(0, Number(due) - QUEUE_CAP)

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold tracking-tight">Revise</h1>
        <Link href="/" className="text-sm font-medium text-accent-deep underline">
          Today
        </Link>
      </header>

      <div className="mb-4 flex items-baseline justify-between">
        <span className="mono-label text-muted">due today · most overdue first</span>
        <span data-testid="revision-debt" className="font-mono text-sm font-bold text-muted">
          debt {debt}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-16 text-center text-muted">Queue clear. Nothing due.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((it) => {
            const late = daysBetween(it.dueOn, today)
            return (
              <div
                key={it.id}
                data-testid={`queue-item-${it.code}-${it.rung}`}
                className="rounded-card border border-line bg-surface p-4 shadow-s"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.colour ?? '#a3a3a3' }}
                  />
                  <span className="mono-label text-muted">{it.rung}</span>
                  <span className="ml-auto font-mono text-xs text-muted">
                    {late === 0 ? 'due today' : `${late}d late`}
                  </span>
                </div>
                <Link href={`/topic/${it.code}`} className="mt-1.5 block">
                  <h2 className="font-display text-lg font-bold leading-snug">{it.name}</h2>
                </Link>
                <div className="mt-3">
                  {it.rung === 'D1' ? (
                    <Link
                      href={`/revise/${it.id}`}
                      className="flex h-12 w-full items-center justify-center rounded-btn bg-accent font-semibold text-white active:bg-accent-deep"
                    >
                      Blind recall
                    </Link>
                  ) : (
                    <form action={completeEvent}>
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        className="h-12 w-full rounded-btn bg-accent font-semibold text-white active:bg-accent-deep"
                      >
                        Done
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {blockDebt.length > 0 && (
        <section className="mt-8">
          <p className="mono-label mb-2 text-muted">block debt · cleared by hand</p>
          <div className="flex flex-col gap-2.5">
            {blockDebt.map((b) => (
              <div key={b.id} data-testid={`block-debt-${b.slot}`}>
                <BlockCard block={{ ...b, owedFrom: displayDateShort(b.date) }} />
                <form action={skipBlock} className="mt-1 flex justify-end">
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" className="px-2 py-1 text-xs text-muted underline">
                    Skip
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
