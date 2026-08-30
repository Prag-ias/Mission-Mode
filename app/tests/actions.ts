'use server'

import { redirect } from 'next/navigation'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { revisionEvents, subjects, testSubjects, tests, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { addDaysISO, todayIST } from '@/lib/dates'

const KINDS = ['sectional', 'full', 'pyq_paper', 'csat'] as const

/**
 * Saves a mock's results: overall totals plus optional per-subject rows.
 * Scoring is UPSC's own arithmetic: +2 per correct, −2/3 per wrong.
 *
 * Any subject scoring below 60% pushes its three weakest topics into the
 * revision queue within seven days — weakest meaning the read topics touched
 * longest ago, which is what a bad mock section usually reveals.
 */
export async function createMock(formData: FormData) {
  if (!(await isAuthed())) return

  const date = String(formData.get('date') || todayIST())
  const source = String(formData.get('source') || '').trim() || null
  const kindRaw = String(formData.get('kind') || 'sectional')
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'sectional'
  const attempted = Number(formData.get('attempted'))
  const correct = Number(formData.get('correct'))
  if (!Number.isInteger(attempted) || attempted < 0 || attempted > 200) return
  if (!Number.isInteger(correct) || correct < 0 || correct > attempted) return

  const wrong = attempted - correct
  const score = Math.round((correct * 2 - wrong * (2 / 3)) * 100) / 100

  const [t] = await db
    .insert(tests)
    .values({ date, source, kind, attempted, correct, score, notesMd: String(formData.get('notes') || '').trim() || null })
    .returning({ id: tests.id })

  const subjectRows = await db.select({ id: subjects.id, code: subjects.code }).from(subjects)
  const weak: number[] = []
  for (const s of subjectRows) {
    const a = Number(formData.get(`s-${s.code}-attempted`))
    const c = Number(formData.get(`s-${s.code}-correct`))
    if (!Number.isInteger(a) || a <= 0) continue
    if (!Number.isInteger(c) || c < 0 || c > a) continue
    await db.insert(testSubjects).values({ testId: t.id, subjectId: s.id, attempted: a, correct: c })
    if (c / a < 0.6) weak.push(s.id)
  }

  const today = todayIST()
  for (const subjectId of weak) {
    // three read topics touched longest ago
    const stale = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.subjectId, subjectId), sql`${topics.stage} <> 'unread' and ${topics.stage} <> 'reading'`))
      .orderBy(sql`${topics.lastTouchedAt} asc nulls first`)
      .limit(3)

    for (const [i, topic] of stale.entries()) {
      const due = addDaysISO(today, [3, 5, 7][i] ?? 7)
      const [pending] = await db
        .select({ id: revisionEvents.id, dueOn: revisionEvents.dueOn })
        .from(revisionEvents)
        .where(
          and(
            eq(revisionEvents.topicId, topic.id),
            isNull(revisionEvents.completedAt),
            sql`${revisionEvents.rung} not like 'PASS%'`,
          ),
        )
        .orderBy(asc(revisionEvents.dueOn))
        .limit(1)
      if (pending) {
        if (pending.dueOn > due) {
          await db.update(revisionEvents).set({ dueOn: due }).where(eq(revisionEvents.id, pending.id))
        }
      } else {
        await db.insert(revisionEvents).values({ topicId: topic.id, rung: 'D30', dueOn: due })
      }
    }
  }

  redirect('/audit')
}
