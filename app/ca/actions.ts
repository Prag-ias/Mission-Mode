'use server'

import { revalidatePath } from 'next/cache'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { caItems, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { todayIST } from '@/lib/dates'

/** Under twenty seconds on a phone: headline, one line, topic tags, done. */
export async function captureCA(formData: FormData) {
  if (!(await isAuthed())) return

  const headline = String(formData.get('headline') || '').trim()
  if (!headline || headline.length > 300) return
  const summary = String(formData.get('summary') || '').trim() || null
  const url = String(formData.get('url') || '').trim() || null

  const codes = String(formData.get('topic_codes') || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 5)
  let topicIds: number[] = []
  if (codes.length) {
    const rows = await db.select({ id: topics.id }).from(topics).where(inArray(topics.code, codes))
    topicIds = rows.map((r) => r.id)
  }

  await db.insert(caItems).values({
    capturedOn: todayIST(),
    headline,
    summary,
    url,
    topicIds: topicIds.length ? topicIds : null,
  })

  revalidatePath('/ca')
}

export async function markBgtDone(formData: FormData) {
  if (!(await isAuthed())) return
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  const { eq } = await import('drizzle-orm')
  await db.update(caItems).set({ bgtDone: true }).where(eq(caItems.id, id))
  revalidatePath('/ca')
}
