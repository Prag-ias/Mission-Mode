'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, notes, planBlocks, revisionEvents, topics } from '@/db/schema'
import { isAuthed, passwordMatches, setAuthCookie } from '@/lib/auth'
import { addDaysISO, todayIST } from '@/lib/dates'
import { MANUAL_STAGES } from '@/lib/stages'
import { advances, isDRung, RUNG_INTERVALS, RUNG_STAGE, SHORTENED_NEXT_DAYS } from '@/lib/ladder'

const MVD_MINUTES = 160

export async function login(formData: FormData) {
  const pw = String(formData.get('password') ?? '')
  if (!passwordMatches(pw)) redirect('/?bad=1')
  await setAuthCookie()
  redirect('/')
}

export async function logBlock(formData: FormData) {
  if (!(await isAuthed())) return

  const id = Number(formData.get('id'))
  const minutes = Math.round(Number(formData.get('minutes')))
  if (!Number.isInteger(id) || !Number.isFinite(minutes) || minutes < 1) return
  const actual = Math.min(minutes, 720)

  const today = todayIST()
  const [block] = await db.select().from(planBlocks).where(eq(planBlocks.id, id)).limit(1)
  if (!block) return
  // Today's blocks, yesterday's (a Block C logged just after midnight), and
  // carried/debt blocks being cleared late. Anything else is refused.
  const recent = block.date === today || block.date === addDaysISO(today, -1)
  if (!recent && block.status !== 'rescheduled') return

  await db
    .update(planBlocks)
    .set({
      actualMinutes: actual,
      status: 'done',
      loggedAt: new Date(),
      backdated: block.date !== today,
    })
    .where(eq(planBlocks.id, id))

  await recomputeFrom(block.date)
  revalidatePath('/')
}

export async function setStage(formData: FormData) {
  if (!(await isAuthed())) return

  const code = String(formData.get('code') ?? '')
  const stage = String(formData.get('stage') ?? '')
  if (!(MANUAL_STAGES as readonly string[]).includes(stage)) return

  const [topic] = await db.select().from(topics).where(eq(topics.code, code)).limit(1)
  if (!topic) return
  // Ladder-owned stages (R1+, mains) are never changed by hand — that is v2's job.
  if (!(MANUAL_STAGES as readonly string[]).includes(topic.stage)) return

  const now = new Date()
  await db
    .update(topics)
    .set({
      stage,
      lastTouchedAt: now,
      firstReadAt: topic.firstReadAt ?? (stage === 'read' ? now : null),
    })
    .where(eq(topics.id, topic.id))

  // Reaching `read` schedules the ladder — once per topic, ever. Bouncing
  // the stage back and forth must not duplicate events.
  if (stage === 'read') {
    const [existing] = await db
      .select({ id: revisionEvents.id })
      .from(revisionEvents)
      .where(eq(revisionEvents.topicId, topic.id))
      .limit(1)
    if (!existing) {
      const today = todayIST()
      await db.insert(revisionEvents).values(
        (Object.entries(RUNG_INTERVALS) as [string, number][]).map(([rung, days]) => ({
          topicId: topic.id,
          rung,
          dueOn: addDaysISO(today, days),
        })),
      )
    }
  }

  revalidatePath('/syllabus')
  revalidatePath(`/topic/${code}`)
}

/** Shared completion: stamp the event, advance the topic's stage monotonically. */
async function completeEventRow(eventId: number, recallScore: number | null) {
  const [event] = await db
    .select()
    .from(revisionEvents)
    .where(and(eq(revisionEvents.id, eventId), isNull(revisionEvents.completedAt)))
    .limit(1)
  if (!event) return null

  await db
    .update(revisionEvents)
    .set({ completedAt: new Date(), recallScore })
    .where(eq(revisionEvents.id, event.id))

  if (isDRung(event.rung)) {
    const [topic] = await db.select().from(topics).where(eq(topics.id, event.topicId)).limit(1)
    const target = RUNG_STAGE[event.rung]
    if (topic && advances(topic.stage, target)) {
      await db
        .update(topics)
        .set({ stage: target, lastTouchedAt: new Date() })
        .where(eq(topics.id, topic.id))
    }
  }
  return event
}

export async function completeEvent(formData: FormData) {
  if (!(await isAuthed())) return
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return

  const [event] = await db
    .select({ rung: revisionEvents.rung })
    .from(revisionEvents)
    .where(eq(revisionEvents.id, id))
    .limit(1)
  // D1 goes through blind recall — it cannot be ticked away.
  if (!event || event.rung === 'D1') return

  await completeEventRow(id, null)
  revalidatePath('/revise')
  revalidatePath('/')
}

/** Blind recall reveal — returns the note body only after the attempt is typed. */
export async function revealNote(eventId: number): Promise<string | null> {
  if (!(await isAuthed())) return null
  const [event] = await db
    .select()
    .from(revisionEvents)
    .where(and(eq(revisionEvents.id, eventId), isNull(revisionEvents.completedAt)))
    .limit(1)
  if (!event || event.rung !== 'D1') return null
  const [note] = await db
    .select({ bodyMd: notes.bodyMd })
    .from(notes)
    .where(eq(notes.topicId, event.topicId))
    .limit(1)
  return note?.bodyMd ?? ''
}

export async function submitRecall(eventId: number, score: number) {
  if (!(await isAuthed())) return
  if (![1, 2, 3].includes(score)) return

  const [event] = await db
    .select({ rung: revisionEvents.rung, topicId: revisionEvents.topicId })
    .from(revisionEvents)
    .where(and(eq(revisionEvents.id, eventId), isNull(revisionEvents.completedAt)))
    .limit(1)
  if (!event || event.rung !== 'D1') return

  await completeEventRow(eventId, score)

  // A failed recall shortens the next interval: D7 pulls in to +3 from today.
  if (score === 1) {
    await db
      .update(revisionEvents)
      .set({ dueOn: addDaysISO(todayIST(), SHORTENED_NEXT_DAYS) })
      .where(
        and(
          eq(revisionEvents.topicId, event.topicId),
          eq(revisionEvents.rung, 'D7'),
          isNull(revisionEvents.completedAt),
        ),
      )
  }

  revalidatePath('/revise')
  revalidatePath('/')
  redirect('/revise')
}

export async function skipBlock(formData: FormData) {
  if (!(await isAuthed())) return
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  // Only debt is skippable by hand — planned and done blocks are not.
  await db
    .update(planBlocks)
    .set({ status: 'skipped' })
    .where(and(eq(planBlocks.id, id), eq(planBlocks.status, 'rescheduled')))
  revalidatePath('/revise')
  revalidatePath('/')
}

export async function saveNote(code: string, body: string): Promise<{ savedAt: string } | null> {
  if (!(await isAuthed())) return null
  if (typeof body !== 'string' || body.length > 100_000) return null

  const [topic] = await db.select().from(topics).where(eq(topics.code, code)).limit(1)
  if (!topic) return null

  const now = new Date()
  const [existing] = await db.select().from(notes).where(eq(notes.topicId, topic.id)).limit(1)
  if (existing) {
    await db.update(notes).set({ bodyMd: body, updatedAt: now }).where(eq(notes.id, existing.id))
  } else {
    await db.insert(notes).values({ topicId: topic.id, bodyMd: body, updatedAt: now })
  }
  await db.update(topics).set({ lastTouchedAt: now }).where(eq(topics.id, topic.id))

  return { savedAt: now.toISOString() }
}

/** Rebuild daily_logs for `date`, then roll the streak forward through today. */
async function recomputeFrom(date: string) {
  const today = todayIST()
  let d = date
  while (d <= today) {
    // Always recompute the endpoints: the block's own day and today — late
    // debt-clearing credits today, which may not have a row yet.
    if (d === date || d === today || (await hasLog(d))) await recomputeDay(d)
    d = addDaysISO(d, 1)
  }
}

async function hasLog(date: string): Promise<boolean> {
  const rows = await db
    .select({ date: dailyLogs.date })
    .from(dailyLogs)
    .where(eq(dailyLogs.date, date))
    .limit(1)
  return rows.length > 0
}

async function recomputeDay(date: string) {
  // Minutes credit the day the work happened: a block logged on its own day
  // (or just after midnight — the v0 backdate window) credits its plan date;
  // a carried/debt block cleared days later credits the day it was cleared.
  // History is never silently rewritten by late work.
  const creditDate = sql`(case
    when ${planBlocks.loggedAt} is null then ${planBlocks.date}::date
    when ((${planBlocks.loggedAt} at time zone 'Asia/Kolkata')::date - ${planBlocks.date}::date) <= 1
      then ${planBlocks.date}::date
    else (${planBlocks.loggedAt} at time zone 'Asia/Kolkata')::date
  end)`
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${planBlocks.actualMinutes}), 0)` })
    .from(planBlocks)
    .where(and(eq(planBlocks.status, 'done'), sql`${creditDate} = ${date}::date`))
  const total = Number(row?.total ?? 0)
  const mvdMet = total >= MVD_MINUTES

  const [prev] = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.date, addDaysISO(date, -1)))
    .limit(1)
  // Streak counts consecutive MVD days — not perfect days.
  const streak = mvdMet ? (prev?.mvdMet ? prev.streakCount : 0) + 1 : 0

  await db
    .insert(dailyLogs)
    .values({ date, totalMinutes: total, mvdMet, streakCount: streak })
    .onConflictDoUpdate({
      target: dailyLogs.date,
      set: { totalMinutes: total, mvdMet, streakCount: streak },
    })
}
