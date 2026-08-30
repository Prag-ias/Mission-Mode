'use client'

import { useRef, useState } from 'react'
import { captureCA } from '@/app/ca/actions'

type TopicOpt = { code: string; name: string }

/**
 * Twenty seconds on a phone: headline, one line, tap a topic or two, Capture.
 * Tags resolve through a native datalist — type a few letters of the topic
 * name or code, pick, add.
 */
export default function CAForm({ topics }: { topics: TopicOpt[] }) {
  const [tags, setTags] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const byLabel = new Map(topics.map((t) => [`${t.code} — ${t.name}`, t.code]))

  function addTag() {
    const code = byLabel.get(draft) ?? (topics.some((t) => t.code === draft.trim().toUpperCase()) ? draft.trim().toUpperCase() : null)
    if (code && !tags.includes(code) && tags.length < 5) setTags((t) => [...t, code])
    setDraft('')
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        fd.set('topic_codes', tags.join(','))
        await captureCA(fd)
        formRef.current?.reset()
        setTags([])
        setDraft('')
      }}
      className="rounded-card border border-line bg-surface p-4 shadow-s sm:p-5"
    >
      <label className="flex flex-col gap-1.5">
        <span className="mono-label text-muted">Headline</span>
        <input
          name="headline"
          aria-label="Headline"
          required
          maxLength={300}
          placeholder="What happened"
          className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base outline-none focus:border-ink"
        />
      </label>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className="mono-label text-muted">One line</span>
        <input
          name="summary"
          aria-label="One line"
          placeholder="Why it matters — one line, no more"
          className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base outline-none focus:border-ink"
        />
      </label>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className="mono-label text-muted">Link · optional</span>
        <input
          name="url"
          aria-label="Link"
          type="url"
          placeholder="https://"
          className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base outline-none focus:border-ink"
        />
      </label>

      <p className="mono-label mb-1.5 mt-4 text-muted">topics</p>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTags((t) => t.filter((x) => x !== c))}
              className="rounded-full border border-line bg-bg px-2.5 py-1 font-mono text-xs"
              title="Remove"
            >
              {c} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          data-testid="tag-input"
          list="ca-topics"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder="Type a topic name or code"
          className="h-11 flex-1 rounded-btn border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
        />
        <button
          type="button"
          data-testid="tag-add"
          onClick={addTag}
          className="h-11 rounded-btn border border-line bg-surface px-4 text-sm font-medium active:bg-bg lg:hover:border-muted"
        >
          Add
        </button>
      </div>
      <datalist id="ca-topics">
        {topics.map((t) => (
          <option key={t.code} value={`${t.code} — ${t.name}`} />
        ))}
      </datalist>

      <button
        type="submit"
        className="mt-4 h-13 h-14 w-full rounded-btn bg-accent text-lg font-semibold text-white active:bg-accent-deep lg:hover:bg-accent-deep"
      >
        Capture
      </button>
    </form>
  )
}
