import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { revisionEvents, subjects, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import RecallFlow from '@/components/RecallFlow'
import BackLink from '@/components/BackLink'

export const dynamic = 'force-dynamic'

export default async function Recall({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) redirect('/')
  const id = Number((await params).id)
  if (!Number.isInteger(id)) redirect('/revise')

  const [event] = await db
    .select({
      id: revisionEvents.id,
      rung: revisionEvents.rung,
      topicName: topics.name,
      topicCode: topics.code,
      subjectName: subjects.name,
      colour: subjects.colour,
    })
    .from(revisionEvents)
    .innerJoin(topics, eq(revisionEvents.topicId, topics.id))
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(and(eq(revisionEvents.id, id), isNull(revisionEvents.completedAt)))
    .limit(1)
  if (!event || event.rung !== 'D1') redirect('/revise')

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-5 lg:max-w-2xl lg:pt-10">
      <BackLink href="/revise" label="Revision queue" />
      <header className="mb-4 flex items-baseline justify-between">
        <span className="mono-label text-muted">D1 · blind recall</span>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: event.colour ?? '#a3a3a3' }}
          />
          {event.subjectName}
        </span>
      </header>

      <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight">
        {event.topicName}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Write what you remember. The note stays hidden until you do.
      </p>

      <RecallFlow eventId={event.id} />
    </main>
  )
}
