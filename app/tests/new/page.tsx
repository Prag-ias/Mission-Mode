import { redirect } from 'next/navigation'
import { asc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { questions, subjects } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { todayIST } from '@/lib/dates'
import { createMock } from '@/app/tests/actions'
import BackLink from '@/components/BackLink'

export const dynamic = 'force-dynamic'

/**
 * Mock results entry. The schema stores totals and per-subject rollups (the
 * paper itself belongs to the test-series provider), so this asks exactly for
 * what it stores: totals from the scorecard, then per-subject rows from the
 * solution review. Under four minutes with the scorecard in hand.
 */
export default async function NewMock() {
  if (!(await isAuthed())) redirect('/')

  const subjectRows = await db
    .select({ code: subjects.code, name: subjects.name, colour: subjects.colour, n: sql<number>`count(${questions.id})` })
    .from(subjects)
    .leftJoin(questions, sql`${questions.subjectId} = ${subjects.id}`)
    .groupBy(subjects.id, subjects.code, subjects.name, subjects.colour)
    .orderBy(asc(subjects.id))

  const num =
    'h-12 w-full rounded-btn border border-line bg-surface px-3 text-center font-mono text-base font-bold outline-none focus:border-ink'

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-5 sm:px-6 lg:max-w-2xl lg:pt-8">
      <BackLink href="/audit" label="Audit" />
      <header className="mb-5">
        <p className="mono-label text-muted">sunday · after the mock</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight lg:text-4xl">Enter the mock</h1>
      </header>

      <form action={createMock} className="flex flex-col gap-5">
        <div className="rounded-card border border-line bg-surface p-4 shadow-s sm:p-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="mono-label text-muted">Date</span>
              <input type="date" name="date" defaultValue={todayIST()} className={num} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="mono-label text-muted">Kind</span>
              <select
                name="kind"
                className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base outline-none focus:border-ink"
              >
                <option value="full">full</option>
                <option value="sectional">sectional</option>
                <option value="pyq_paper">pyq paper</option>
                <option value="csat">csat</option>
              </select>
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="mono-label text-muted" id="src-label">
              Source
            </span>
            <input
              type="text"
              name="source"
              aria-label="Source"
              placeholder="Forum IAS Sectional 4"
              className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base outline-none focus:border-ink"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="mono-label text-muted">Attempted</span>
              <input type="number" name="attempted" aria-label="Attempted" min={0} max={200} required className={num} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="mono-label text-muted">Correct</span>
              <input type="number" name="correct" aria-label="Correct" min={0} max={200} required className={num} />
            </label>
          </div>
          <p className="mt-3 text-xs text-muted">Score is computed as +2 a correct, −⅔ a wrong. Target 120; 2025 cut-off 92.66.</p>
        </div>

        <div className="rounded-card border border-line bg-surface p-4 shadow-s sm:p-5">
          <p className="mono-label text-muted">per subject · from the solution review</p>
          <p className="mb-3 mt-1 text-sm text-muted">
            Fill only the subjects the mock covered. A subject under 60% pushes its three stalest
            topics into the revision queue this week.
          </p>
          <div className="flex flex-col gap-2">
            {subjectRows.map((s) => (
              <div
                key={s.code}
                data-testid={`subject-row-${s.code}`}
                className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: s.colour ?? '#a3a3a3' }}
                  />
                  {s.code}
                </span>
                <input
                  type="number"
                  name={`s-${s.code}-attempted`}
                  aria-label="Attempted"
                  min={0}
                  max={200}
                  placeholder="att"
                  className="h-11 rounded-btn border border-line bg-surface px-2 text-center font-mono text-sm outline-none focus:border-ink"
                />
                <input
                  type="number"
                  name={`s-${s.code}-correct`}
                  aria-label="Correct"
                  min={0}
                  max={200}
                  placeholder="corr"
                  className="h-11 rounded-btn border border-line bg-surface px-2 text-center font-mono text-sm outline-none focus:border-ink"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="h-14 w-full rounded-btn bg-accent text-lg font-semibold text-white active:bg-accent-deep lg:hover:bg-accent-deep"
        >
          Save mock
        </button>
      </form>
    </main>
  )
}
