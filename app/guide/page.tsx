import { redirect } from 'next/navigation'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { books } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { displayDate, hourIST, todayIST } from '@/lib/dates'
import { MVD_NOTE, routineFor, SLEEP_NOTE, toMin } from '@/lib/routine'
import { setBookStatus } from '@/app/guide/actions'

export const dynamic = 'force-dynamic'

const TIERS: { key: string; label: string }[] = [
  { key: 'owned', label: 'Already owned' },
  { key: 'tier1', label: 'Tier 1 — order by 7 September' },
  { key: 'sociology', label: 'Sociology optional — by 15 September' },
  { key: 'tier2', label: 'Tier 2 — by mid-October' },
  { key: 'tier3', label: 'Tier 3 — January onward' },
]

const STATUSES = [
  { value: 'owned', label: 'Have it' },
  { value: 'to_buy', label: 'To buy' },
  { value: 'pdf', label: 'Free PDF' },
] as const

const KIND_TINT: Record<string, string> = {
  study: 'tint-dawn',
  work: '',
  life: '',
  sleep: 'tint-night',
}

export default async function Guide() {
  if (!(await isAuthed())) redirect('/')

  const today = todayIST()
  const dow = new Date(today + 'T00:00:00Z').getUTCDay()
  const routine = routineFor(dow)

  // minute-of-day in IST, for highlighting the row the clock is inside
  const nowMin =
    hourIST() * 60 +
    Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', minute: 'numeric' }).format(new Date()),
    )

  const bookRows = await db.select().from(books).orderBy(asc(books.sort))
  const toBuy = bookRows.filter((b) => b.status === 'to_buy')
  const stillToSpend = toBuy.reduce((s, b) => {
    const m = /₹([\d,]+)/.exec(b.price ?? '')
    return s + (m ? Number(m[1].replace(/,/g, '')) : 0)
  }, 0)

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-5 sm:px-6 lg:max-w-3xl lg:pt-8">
      <header className="mb-5">
        <p className="mono-label text-muted">the field guide</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight lg:text-4xl">
          {displayDate(today)}
        </h1>
      </header>

      <section id="routine" className="scroll-mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">{routine.label}</h2>
          <span data-testid="routine-load" className="font-mono text-xs font-bold text-muted">
            {routine.studyLoad}
          </span>
        </div>

        <ol data-testid="routine-list" className="mt-3 flex flex-col gap-1.5">
          {routine.rows.map((r) => {
            const active = nowMin >= toMin(r.start) && (r.end === null || nowMin < toMin(r.end))
            return (
              <li
                key={r.start + r.title}
                className={`flex items-start gap-3 rounded-btn border p-3 ${
                  r.kind === 'study' ? `bg-surface shadow-s ${KIND_TINT[r.kind]}` : 'border-transparent'
                } ${active ? 'border-accent' : r.kind === 'study' ? 'border-line' : ''}`}
              >
                <span className="w-24 shrink-0 pt-0.5 font-mono text-xs font-bold tabular-nums text-muted">
                  {r.start}
                  {r.end ? `–${r.end}` : ''}
                </span>
                <span className="flex-1">
                  <span className={`block leading-snug ${r.kind === 'study' ? 'font-display font-bold' : 'text-sm text-ink'}`}>
                    {r.title}
                  </span>
                  {r.detail && <span className="mt-0.5 block text-xs text-muted">{r.detail}</span>}
                </span>
                {active && (
                  <span data-testid="routine-now" className="mono-label shrink-0 rounded-full border border-accent px-2 py-0.5 text-accent-deep">
                    now
                  </span>
                )}
              </li>
            )
          })}
        </ol>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <p className="rounded-btn border border-line bg-surface p-3 text-xs text-muted">{MVD_NOTE}</p>
          <p className="rounded-btn border border-line bg-surface p-3 text-xs text-muted">{SLEEP_NOTE}</p>
        </div>
      </section>

      <section id="books" className="mt-10 scroll-mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">The list, and what it costs</h2>
          <span data-testid="still-to-spend" className="font-mono text-xs font-bold text-muted">
            ₹{stillToSpend.toLocaleString('en-IN')} still to buy
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          This list is closed — nothing gets added before February without deleting something else.
          Waiting for a delivery is the most preventable way to lose a week.
        </p>

        {TIERS.map((tier) => {
          const rows = bookRows.filter((b) => b.tier === tier.key)
          if (rows.length === 0) return null
          return (
            <div key={tier.key} className="mt-5">
              <p className="mono-label mb-2 text-muted">{tier.label}</p>
              <div className="flex flex-col gap-2">
                {rows.map((b) => (
                  <article
                    key={b.id}
                    data-testid={`book-${b.id}`}
                    className={`rounded-card border border-line bg-surface p-3.5 shadow-s ${b.status === 'owned' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={`font-display font-bold leading-snug ${b.status === 'owned' ? 'text-muted' : ''}`}>
                        {b.title}
                      </p>
                      {b.price && <span className="mono-label shrink-0 text-muted">{b.price}</span>}
                    </div>
                    {b.detail && <p className="mt-1 text-xs text-muted">{b.detail}</p>}
                    <div className="mt-2.5 flex gap-1.5">
                      {STATUSES.map((s) => (
                        <form key={s.value} action={setBookStatus} className="flex-1">
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="status" value={s.value} />
                          <button
                            type="submit"
                            data-testid={`book-${b.id}-${s.value}`}
                            disabled={b.status === s.value}
                            className={`h-10 w-full rounded-btn border text-xs font-medium transition ${
                              b.status === s.value
                                ? s.value === 'owned'
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300'
                                  : s.value === 'pdf'
                                    ? 'border-dusk-deep bg-dusk text-ink'
                                    : 'border-accent bg-surface text-accent-deep'
                                : 'border-line bg-surface text-muted lg:hover:border-muted'
                            }`}
                            style={s.value === 'pdf' && b.status === s.value ? { borderColor: 'var(--dusk-deep)', backgroundColor: 'var(--dusk)' } : undefined}
                          >
                            {s.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )
        })}

        <p className="mt-5 rounded-btn border border-line bg-surface p-3 text-xs text-muted">
          Roughly ₹6,400 in books plus ₹4,500 for a test series — about ₹11,000 for the whole
          Prelims campaign, with the optional&rsquo;s most important material free. Spend on
          material, not on courses.
        </p>
      </section>
    </main>
  )
}
