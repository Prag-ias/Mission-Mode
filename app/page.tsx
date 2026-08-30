import Link from 'next/link'
import { and, asc, eq, gt, gte, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, phases, planBlocks, revisionEvents, subjects, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { addDaysISO, daysBetween, displayDate, displayDateShort, EXAM_DATE, hourIST, todayIST } from '@/lib/dates'
import { CARRY_DAYS, QUEUE_CAP } from '@/lib/ladder'
import { sweepMissedBlocks } from '@/lib/sweep'
import { login } from '@/app/actions'
import BlockCard from '@/components/BlockCard'

export const dynamic = 'force-dynamic'

export default async function Today({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>
}) {
  const { bad } = await searchParams
  if (!(await isAuthed())) return <Gate bad={bad === '1'} />

  const today = todayIST()
  await sweepMissedBlocks()

  // today's blocks, plus carried blocks from the last two days — still owed
  // (rescheduled), or cleared today (done with today's timestamp)
  const visibleWhere = or(
    eq(planBlocks.date, today),
    and(
      gte(planBlocks.date, addDaysISO(today, -CARRY_DAYS)),
      lt(planBlocks.date, today),
      or(
        eq(planBlocks.status, 'rescheduled'),
        and(
          eq(planBlocks.status, 'done'),
          sql`(${planBlocks.loggedAt} at time zone 'Asia/Kolkata')::date = ${today}::date`,
        ),
      ),
    ),
  )

  const [blocks, [phase], [nextPhase], [log], [prevLog], [{ due }]] = await Promise.all([
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
      .where(visibleWhere)
      .orderBy(asc(planBlocks.date), asc(planBlocks.start), asc(planBlocks.slot)),
    db
      .select()
      .from(phases)
      .where(and(lte(phases.startsOn, today), gte(phases.endsOn, today)))
      .limit(1),
    db.select().from(phases).where(gt(phases.startsOn, today)).orderBy(asc(phases.startsOn)).limit(1),
    db.select().from(dailyLogs).where(eq(dailyLogs.date, today)).limit(1),
    db.select().from(dailyLogs).where(eq(dailyLogs.date, addDaysISO(today, -1))).limit(1),
    db
      .select({ due: sql<number>`count(*)` })
      .from(revisionEvents)
      .where(and(lte(revisionEvents.dueOn, today), isNull(revisionEvents.completedAt))),
  ])

  const debt = Math.max(0, Number(due) - QUEUE_CAP)

  const daysLeft = daysBetween(today, EXAM_DATE)
  const total = log?.totalMinutes ?? 0
  const mvdMet = log?.mvdMet ?? false
  // A day in progress shows yesterday's streak until today's MVD lands.
  const streak = mvdMet ? log.streakCount : prevLog?.mvdMet ? prevLog.streakCount : 0

  const phaseLine = phase
    ? `${phase.code} · ${phase.name}`
    : nextPhase
      ? `${nextPhase.name} — starts ${displayDate(nextPhase.startsOn)}`
      : 'Plan complete'

  const h = hourIST()
  const greeting = h < 4 ? 'late block' : h < 12 ? 'good morning' : h < 17 ? 'good afternoon' : h < 21 ? 'good evening' : 'late block'

  const emptyLine =
    today < '2026-08-31'
      ? 'Nothing today. Day 1 is Monday 31 August, 05:30.'
      : today > EXAM_DATE
        ? 'The plan is complete.'
        : 'No blocks planned today.'

  return (
    <main className="mx-auto max-w-md px-4 pb-20 pt-5 lg:max-w-5xl lg:px-8 lg:pb-24 lg:pt-6">
      <header className="mb-4 pr-12 lg:pr-0">
        <p className="mono-label text-muted">{greeting}</p>
        <div className="mt-0.5 flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight lg:text-4xl">{displayDate(today)}</h1>
          <span className="text-sm text-muted">
            <span className="font-mono font-bold text-ink">{daysLeft}</span> days left
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <p className="mono-label text-muted">{phaseLine}</p>

        </div>
      </header>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        {blocks.length === 0 ? (
          <p className="mt-16 text-center text-muted lg:col-span-2">{emptyLine}</p>
        ) : (
          blocks.map((b) => (
            <BlockCard
              key={b.id}
              block={{ ...b, owedFrom: b.date !== today ? displayDateShort(b.date) : null }}
            />
          ))
        )}
      </div>

      <footer
        data-testid="footer"
        className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] border-y border-line bg-surface/95 backdrop-blur lg:bottom-0 lg:border-b-0"
      >
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:max-w-5xl lg:px-8">
          <span className="flex items-center gap-2 text-sm text-muted">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6 -rotate-90">
              <circle cx="12" cy="12" r="9" fill="none" stroke="var(--line)" strokeWidth="3.5" />
              <circle
                cx="12" cy="12" r="9" fill="none"
                stroke={mvdMet ? 'var(--dawn-deep)' : 'var(--accent)'}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${Math.min(1, total / 160) * 56.5} 56.5`}
              />
            </svg>
            <span>
              <span className="font-mono text-base font-bold text-ink">{total}</span> min
            </span>
          </span>
          <span
            className={
              mvdMet ? 'text-sm font-semibold text-accent-deep' : 'font-mono text-sm text-muted'
            }
          >
            {mvdMet ? 'MVD met' : `MVD ${total}/160`}
          </span>
          <span className="text-sm text-muted">
            streak <span className="font-mono font-bold text-ink">{streak}</span> d
          </span>
          <Link href="/revise" className="text-sm text-muted underline">
            debt <span className="font-mono font-bold text-ink">{debt}</span>
          </Link>
        </div>
      </footer>
    </main>
  )
}

function Gate({ bad }: { bad: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <svg aria-hidden viewBox="0 0 64 64" className="size-14">
        <rect width="64" height="64" rx="14" fill="#16181D" />
        <circle cx="32" cy="32" r="12" fill="#FF6B5E" />
      </svg>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">Sarthi</h1>
      <p className="mt-1 text-sm text-muted">The app decides. You execute.</p>
      <form action={login} className="mt-5 flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoFocus
          className="h-14 rounded-btn border border-line bg-surface px-4 text-lg outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="h-14 rounded-btn bg-accent text-lg font-semibold text-white active:bg-accent-deep"
        >
          Enter
        </button>
        {bad && <p className="text-sm text-accent-deep">Wrong password.</p>}
      </form>
    </main>
  )
}
