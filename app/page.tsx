import Link from 'next/link'
import { and, asc, eq, gt, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, phases, planBlocks, subjects, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { addDaysISO, daysBetween, displayDate, EXAM_DATE, todayIST } from '@/lib/dates'
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

  const [blocks, [phase], [nextPhase], [log], [prevLog]] = await Promise.all([
    db
      .select({
        id: planBlocks.id,
        slot: planBlocks.slot,
        start: planBlocks.start,
        label: planBlocks.label,
        sourceRef: planBlocks.sourceRef,
        plannedMinutes: planBlocks.plannedMinutes,
        actualMinutes: planBlocks.actualMinutes,
        status: planBlocks.status,
        colour: subjects.colour,
        topicCode: topics.code,
      })
      .from(planBlocks)
      .leftJoin(subjects, eq(planBlocks.subjectId, subjects.id))
      .leftJoin(topics, eq(planBlocks.topicId, topics.id))
      .where(eq(planBlocks.date, today))
      .orderBy(asc(planBlocks.start), asc(planBlocks.slot)),
    db
      .select()
      .from(phases)
      .where(and(lte(phases.startsOn, today), gte(phases.endsOn, today)))
      .limit(1),
    db.select().from(phases).where(gt(phases.startsOn, today)).orderBy(asc(phases.startsOn)).limit(1),
    db.select().from(dailyLogs).where(eq(dailyLogs.date, today)).limit(1),
    db.select().from(dailyLogs).where(eq(dailyLogs.date, addDaysISO(today, -1))).limit(1),
  ])

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

  const emptyLine =
    today < '2026-08-31'
      ? 'Nothing today. Day 1 is Monday 31 August, 05:30.'
      : today > EXAM_DATE
        ? 'The plan is complete.'
        : 'No blocks planned today.'

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-5">
      <header className="mb-4">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-xl font-bold tracking-tight">{displayDate(today)}</h1>
          <span className="text-sm text-muted">
            <span className="font-mono font-bold text-ink">{daysLeft}</span> days left
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <p className="mono-label text-muted">{phaseLine}</p>
          <Link href="/syllabus" className="text-sm font-medium text-accent-deep underline">
            Syllabus
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {blocks.length === 0 ? (
          <p className="mt-16 text-center text-muted">{emptyLine}</p>
        ) : (
          blocks.map((b) => <BlockCard key={b.id} block={b} />)
        )}
      </div>

      <footer
        data-testid="footer"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="text-sm text-muted">
            <span className="font-mono text-base font-bold text-ink">{total}</span> min
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
