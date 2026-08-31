import { redirect } from 'next/navigation'
import { asc, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { caItems, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { displayDateShort, todayIST } from '@/lib/dates'
import { markBgtDone } from '@/app/ca/actions'
import CAForm from '@/components/CAForm'
import BackLink from '@/components/BackLink'

export const dynamic = 'force-dynamic'

export default async function CA() {
  if (!(await isAuthed())) redirect('/')
  const today = todayIST()
  const isSunday = new Date(today + 'T00:00:00Z').getUTCDay() === 0

  const [topicRows, items] = await Promise.all([
    db
      .select({ code: topics.code, name: topics.name })
      .from(topics)
      .orderBy(asc(topics.code)),
    db.select().from(caItems).orderBy(desc(caItems.capturedOn), desc(caItems.id)).limit(60),
  ])

  const idToCode = new Map<number, string>()
  {
    const all = await db.select({ id: topics.id, code: topics.code }).from(topics)
    for (const t of all) idToCode.set(t.id, t.code)
  }

  const [{ n: weekCount }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(caItems)
    .where(sql`${caItems.capturedOn} >= (${today}::date - 7)`)

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-5 sm:px-6 lg:max-w-2xl lg:pt-8">
      <BackLink href="/audit" label="Audit" />
      <header className="mb-5">
        <p className="mono-label text-muted">current affairs · {Number(weekCount)} this week</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight lg:text-4xl">Capture</h1>
      </header>

      {isSunday && (
        <div className="mb-4 rounded-card border border-line bg-surface p-4 tint-day shadow-s">
          <p className="mono-label text-muted">sunday · bio-geo-tech drill</p>
          <p className="mt-1 text-sm">
            For each science or environment item this week: <b>what is the science, where on the map,
            which ecosystem?</b> Tick the drill on each item below once done.
          </p>
        </div>
      )}

      <CAForm topics={topicRows} />

      <section className="mt-6 flex flex-col gap-2.5">
        {items.length === 0 ? (
          <p className="mt-8 text-center text-muted">Nothing captured yet.</p>
        ) : (
          items.map((it) => {
            const codes = Array.isArray(it.topicIds) ? (it.topicIds as number[]).map((id) => idToCode.get(id)).filter(Boolean) : []
            return (
              <article key={it.id} className="rounded-card border border-line bg-surface p-4 shadow-s">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display font-bold leading-snug">{it.headline}</p>
                  <span className="mono-label shrink-0 text-muted">{displayDateShort(it.capturedOn)}</span>
                </div>
                {it.summary && <p className="mt-1 text-sm text-muted">{it.summary}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {codes.map((c) => (
                    <span key={c} className="rounded-full border border-line bg-bg px-2 py-0.5 font-mono text-[10px]">
                      {c}
                    </span>
                  ))}
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noreferrer" className="text-xs text-accent-deep underline">
                      source
                    </a>
                  )}
                  {it.bgtDone ? (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted">drilled ✓</span>
                  ) : (
                    <form action={markBgtDone} className="ml-auto">
                      <input type="hidden" name="id" value={it.id} />
                      <button type="submit" className="text-xs text-muted underline">
                        mark drill done
                      </button>
                    </form>
                  )}
                </div>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}
