import { and, asc, eq, gt, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, phases, planBlocks, subjects } from '@/db/schema'
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
      })
      .from(planBlocks)
      .leftJoin(subjects, eq(planBlocks.subjectId, subjects.id))
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
          <h1 className="text-lg font-semibold">{displayDate(today)}</h1>
          <span className="text-sm tabular-nums text-neutral-500">{daysLeft} days left</span>
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">{phaseLine}</p>
      </header>

      <div className="flex flex-col gap-3">
        {blocks.length === 0 ? (
          <p className="mt-16 text-center text-neutral-500">{emptyLine}</p>
        ) : (
          blocks.map((b) => <BlockCard key={b.id} block={b} />)
        )}
      </div>

      <footer
        data-testid="footer"
        className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="text-sm text-neutral-500">
            <span className="text-base font-semibold tabular-nums text-neutral-900">{total}</span> min
          </span>
          <span
            className={
              mvdMet ? 'text-sm font-medium text-green-700' : 'text-sm tabular-nums text-neutral-500'
            }
          >
            {mvdMet ? 'MVD met' : `MVD ${total}/160`}
          </span>
          <span className="text-sm text-neutral-500">
            streak <span className="font-semibold tabular-nums text-neutral-900">{streak}</span> d
          </span>
        </div>
      </footer>
    </main>
  )
}

function Gate({ bad }: { bad: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sarthi</h1>
      <form action={login} className="mt-5 flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoFocus
          className="h-14 rounded-xl border border-neutral-300 bg-white px-4 text-lg outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          className="h-14 rounded-xl bg-neutral-900 text-lg font-medium text-white active:bg-neutral-700"
        >
          Enter
        </button>
        {bad && <p className="text-sm text-red-600">Wrong password.</p>}
      </form>
    </main>
  )
}
