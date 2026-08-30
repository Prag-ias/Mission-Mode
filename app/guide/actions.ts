'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { books } from '@/db/schema'
import { isAuthed } from '@/lib/auth'

const ALLOWED = ['owned', 'to_buy', 'pdf'] as const

export async function setBookStatus(formData: FormData) {
  if (!(await isAuthed())) return
  const id = Number(formData.get('id'))
  const status = String(formData.get('status'))
  if (!Number.isInteger(id)) return
  if (!(ALLOWED as readonly string[]).includes(status)) return
  await db.update(books).set({ status }).where(eq(books.id, id))
  revalidatePath('/guide')
}
