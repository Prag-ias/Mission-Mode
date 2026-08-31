import { notFound, redirect } from 'next/navigation'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { caItems, notes, subjects, topicMaterials, topics } from '@/db/schema'
import { isAuthed } from '@/lib/auth'
import { MANUAL_STAGES, STAGE_BG, STAGE_TEXT, type Stage } from '@/lib/stages'
import { setStage } from '@/app/actions'
import { addMaterialLink, deleteMaterial, uploadMaterial } from '@/app/topic/actions'
import { storageReady } from '@/lib/storage'
import NoteEditor from '@/components/NoteEditor'
import BackLink from '@/components/BackLink'

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

  const ca = await db
    .select()
    .from(caItems)
    .where(sql`${caItems.topicIds} @> ${JSON.stringify([topic.id])}::jsonb`)
    .orderBy(desc(caItems.capturedOn))
    .limit(10)

  // 'sheet' sorts before 'user': curated reading first, own material after
  const materials = await db
    .select()
    .from(topicMaterials)
    .where(eq(topicMaterials.topicId, topic.id))
    .orderBy(asc(topicMaterials.source), asc(topicMaterials.id))

  const manual = (MANUAL_STAGES as readonly string[]).includes(topic.stage)

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-5 lg:max-w-3xl lg:pt-10">
      <header className="mb-4 flex items-baseline justify-between">
        <BackLink href="/syllabus" label="Syllabus" />
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
          className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest ${STAGE_BG[topic.stage as Stage] ?? 'bg-stone-200'} ${STAGE_TEXT[topic.stage as Stage] ?? 'text-ink'}`}
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
                    ? 'border-ink bg-ink text-bg'
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

      <section className="mt-6" data-testid="materials">
        <p className="mono-label mb-2 text-muted">materials &amp; reading</p>
        {materials.length === 0 && (
          <p className="text-sm text-muted">Nothing attached. Optional — the book is the syllabus.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 rounded-btn border border-line bg-surface px-3 py-2.5 text-sm shadow-s"
            >
              <span className="mono-label shrink-0 text-muted">
                {m.kind === 'file' ? 'file' : m.source === 'sheet' ? 'ref' : 'link'}
              </span>
              <a
                href={`/api/material/${m.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium underline-offset-2 hover:underline"
              >
                {m.title}
              </a>
              {m.sizeBytes != null && (
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {(m.sizeBytes / 1048576).toFixed(1)} MB
                </span>
              )}
              {m.source === 'user' && (
                <form action={deleteMaterial}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="code" value={topic.code} />
                  <button
                    type="submit"
                    aria-label={`Remove ${m.title}`}
                    className="grid size-7 place-items-center rounded-md text-muted active:bg-bg lg:hover:bg-bg"
                  >
                    ×
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-accent-deep">Add material</summary>
          <form action={addMaterialLink} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="code" value={topic.code} />
            <input
              name="title"
              required
              placeholder="Label — e.g. Class notes photo, PIB explainer"
              className="h-11 rounded-btn border border-line bg-surface px-3 text-sm"
            />
            <input
              name="url"
              type="url"
              required
              placeholder="https://…"
              className="h-11 rounded-btn border border-line bg-surface px-3 text-sm"
            />
            <button
              type="submit"
              className="h-11 rounded-btn border border-line bg-surface font-medium active:bg-bg lg:hover:bg-bg"
            >
              Add link
            </button>
          </form>
          {storageReady() ? (
            <form action={uploadMaterial} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="code" value={topic.code} />
              <input
                name="file"
                type="file"
                required
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="text-sm text-muted file:mr-3 file:h-9 file:rounded-btn file:border file:border-line file:bg-bg file:px-3 file:font-medium file:text-ink"
              />
              <button
                type="submit"
                className="h-11 rounded-btn border border-line bg-surface font-medium active:bg-bg lg:hover:bg-bg"
              >
                Upload file
              </button>
              <p className="text-xs text-muted">PDF or image, up to 20 MB.</p>
            </form>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Uploads switch on once SUPABASE_SERVICE_KEY is set in the env.
            </p>
          )}
        </details>
      </section>

      {ca.length > 0 && (
        <section className="mt-6" data-testid="ca-list">
          <p className="mono-label mb-2 text-muted">current affairs on this topic</p>
          <div className="flex flex-col gap-2">
            {ca.map((it) => (
              <div key={it.id} className="rounded-btn border border-line bg-surface p-3 text-sm shadow-s">
                <p className="font-medium">{it.headline}</p>
                {it.summary && <p className="mt-0.5 text-muted">{it.summary}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
