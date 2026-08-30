import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notes, subjects, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { MANUAL_STAGES, STAGE_BG, type Stage } from '@/lib/stages'
import { setStage } from '@/app/actions'
import NoteEditor from '@/components/NoteEditor'

export const dynamic = 'force-dynamic'

export default async function Topic({ params }: { params: Promise<{ code: string }> }) {
  if (!(await isAuthed())) redirect('/')
  const { code } = await params

  const [topic] = await db
    .select({
      id: topics.id,
      code: topics.code,
      name: topics.name,
      sourceRef: topics.sourceRef,
      estMinutes: topics.estMinutes,
      stage: topics.stage,
      subjectName: subjects.name,
      colour: subjects.colour,
    })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(eq(topics.code, code))
    .limit(1)
  if (!topic) notFound()

  const [note] = await db
    .select()
    .from(notes)
    .where(eq(notes.topicId, topic.id))
    .orderBy(desc(notes.updatedAt))
    .limit(1)

  const manual = (MANUAL_STAGES as readonly string[]).includes(topic.stage)

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-5 lg:max-w-3xl lg:pt-10">
      <header className="mb-4 flex items-baseline justify-between">
        <Link href="/syllabus" className="text-sm font-medium text-accent-deep underline">
          Syllabus
        </Link>
        <span className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: topic.colour ?? '#a3a3a3' }}
          />
          {topic.subjectName}
        </span>
      </header>

      <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight lg:text-4xl">
        {topic.name}
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        {topic.sourceRef && <>{topic.sourceRef} · </>}
        <span className="font-mono">~{topic.estMinutes} min</span> first read
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span
          data-testid="stage-current"
          className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest ${STAGE_BG[topic.stage as Stage] ?? 'bg-stone-200'} ${topic.stage === 'mains' || topic.stage.startsWith('R') ? 'text-white' : 'text-ink'}`}
        >
          {topic.stage}
        </span>
        {!manual && <span className="text-xs text-muted">advanced by the revision ladder</span>}
      </div>

      {manual && (
        <div className="mt-3 flex gap-2">
          {MANUAL_STAGES.map((s) => (
            <form key={s} action={setStage} className="flex-1">
              <input type="hidden" name="code" value={topic.code} />
              <input type="hidden" name="stage" value={s} />
              <button
                type="submit"
                disabled={s === topic.stage}
                className={`h-12 w-full rounded-btn border font-mono text-xs tracking-widest ${
                  s === topic.stage
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-surface text-ink active:bg-bg'
                }`}
              >
                {s}
              </button>
            </form>
          ))}
        </div>
      )}

      <section className="mt-6">
        <NoteEditor code={topic.code} initialBody={note?.bodyMd ?? ''} />
      </section>
    </main>
  )
}
