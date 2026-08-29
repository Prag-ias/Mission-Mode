'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, notes, planBlocks, topics } from '@/db/schema'
import { isAuthed, passwordMatches, setAuthCookie } from '@/lib/auth'
import { addDaysISO, todayIST } from '@/lib/dates'
import { MANUAL_STAGES } from '@/lib/stages'

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
  // The screen only ever shows today. Accept yesterday too, for a Block C
  // logged just after midnight; refuse anything older.
  if (block.date !== today && block.date !== addDaysISO(today, -1)) return

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

  revalidatePath('/syllabus')
  revalidatePath(`/topic/${code}`)
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
    if (d === date || (await hasLog(d))) await recomputeDay(d)
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
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${planBlocks.actualMinutes}), 0)` })
    .from(planBlocks)
    .where(and(eq(planBlocks.date, date), eq(planBlocks.status, 'done')))
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
