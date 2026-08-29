'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, planBlocks } from '@/db/schema'
import { isAuthed, passwordMatches, setAuthCookie } from '@/lib/auth'
import { addDaysISO, todayIST } from '@/lib/dates'

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
