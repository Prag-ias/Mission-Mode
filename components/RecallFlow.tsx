'use client'

import { useState, useTransition } from 'react'
import { revealNote, submitRecall } from '@/app/actions'

/**
 * Blind recall: type first, reveal after. The note body never reaches the
 * client until the attempt is written — revealNote fetches it on demand.
 */
export default function RecallFlow({ eventId }: { eventId: number }) {
  const [note, setNote] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (note === null) {
    return (
      <form
        className="mt-5"
        action={() =>
          startTransition(async () => {
            const body = await revealNote(eventId)
            setNote(body ?? '')
          })
        }
      >
        <textarea
          aria-label="What do you remember"
          placeholder="Everything you can pull from memory…"
          autoFocus
          className="min-h-[40vh] w-full resize-y rounded-btn border border-line bg-surface p-4 text-base leading-relaxed outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-3 h-14 w-full rounded-btn bg-accent text-lg font-semibold text-white active:bg-accent-deep disabled:opacity-50"
        >
          {pending ? 'Revealing…' : 'Reveal note'}
        </button>
      </form>
    )
  }

  return (
    <div className="mt-5">
      <p className="mono-label mb-1.5 text-muted">the note</p>
      <div className="whitespace-pre-wrap rounded-card border border-line bg-surface p-4 text-base leading-relaxed">
        {note.trim() === '' ? <span className="text-muted">No note on this topic yet.</span> : note}
      </div>

      <p className="mono-label mb-1.5 mt-6 text-muted">how much came back</p>
      <div className="flex gap-2">
        {(
          [
            [1, 'barely'],
            [2, 'partly'],
            [3, 'most of it'],
          ] as const
        ).map(([score, hint]) => (
          <button
            key={score}
            type="button"
            aria-label={String(score)}
            disabled={pending}
            onClick={() => startTransition(() => submitRecall(eventId, score))}
            className="h-16 flex-1 rounded-btn border border-line bg-surface active:bg-bg disabled:opacity-50"
          >
            <span className="block font-mono text-xl font-bold">{score}</span>
            <span className="block text-xs text-muted">{hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">1 pulls the next revision closer.</p>
    </div>
  )
}
