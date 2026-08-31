/** Opens one material: links redirect straight out, files get a fresh
 *  one-hour signed URL from the private bucket. */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { topicMaterials } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { signedUrl, storageReady } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return new NextResponse('unauthorized', { status: 401 })
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return new NextResponse('bad id', { status: 400 })
  const [row] = await db.select().from(topicMaterials).where(eq(topicMaterials.id, id)).limit(1)
  if (!row) return new NextResponse('not found', { status: 404 })
  if (row.kind === 'link') return NextResponse.redirect(row.url)
  if (!storageReady()) return new NextResponse('storage key not configured', { status: 503 })
  return NextResponse.redirect(await signedUrl(row.url))
}
