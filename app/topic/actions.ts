'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { topicMaterials, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { removeObject, storageReady, uploadObject } from '@/lib/storage'

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

async function topicIdFor(code: string): Promise<number | null> {
  const [t] = await db.select({ id: topics.id }).from(topics).where(eq(topics.code, code)).limit(1)
  return t?.id ?? null
}

export async function addMaterialLink(formData: FormData) {
  if (!(await isAuthed())) return
  const code = String(formData.get('code') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const url = String(formData.get('url') ?? '').trim()
  if (!title || !/^https?:\/\/\S+$/.test(url)) return
  const topicId = await topicIdFor(code)
  if (!topicId) return
  await db.insert(topicMaterials).values({ topicId, kind: 'link', source: 'user', title: title.slice(0, 200), url })
  revalidatePath(`/topic/${code}`)
}

export async function uploadMaterial(formData: FormData) {
  if (!(await isAuthed())) return
  if (!storageReady()) return
  const code = String(formData.get('code') ?? '')
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return
  const topicId = await topicIdFor(code)
  if (!topicId) return

  const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 60) || 'file'
  const path = `${code}/${Date.now()}-${safeName}.${ext}`
  await uploadObject(path, await file.arrayBuffer(), file.type)
  await db.insert(topicMaterials).values({
    topicId, kind: 'file', source: 'user',
    title: file.name.slice(0, 200), url: path, sizeBytes: file.size,
  })
  revalidatePath(`/topic/${code}`)
}

export async function deleteMaterial(formData: FormData) {
  if (!(await isAuthed())) return
  const id = Number(formData.get('id'))
  const code = String(formData.get('code') ?? '')
  if (!Number.isInteger(id)) return
  // sheet rows are managed by the sync script, not deletable from the page —
  // a delete here would silently resurrect on the next sync
  const [row] = await db
    .select()
    .from(topicMaterials)
    .where(and(eq(topicMaterials.id, id), eq(topicMaterials.source, 'user')))
    .limit(1)
  if (!row) return
  if (row.kind === 'file' && storageReady()) await removeObject(row.url).catch(() => {})
  await db.delete(topicMaterials).where(eq(topicMaterials.id, id))
  revalidatePath(`/topic/${code}`)
}
