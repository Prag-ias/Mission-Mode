'use client'

import { useEffect, useRef, useState } from 'react'
import { saveNote } from '@/app/actions'

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/**
 * One markdown note per topic. No save button: 800ms after typing stops the
 * note is written, and again on blur / tab-hide / unmount so a phone locking
 * mid-thought loses nothing.
 */
export default function NoteEditor({ code, initialBody }: { code: string; initialBody: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRef = useRef<Status>('idle')
  const [status, setStatusState] = useState<Status>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const setStatus = (s: Status) => {
    statusRef.current = s
    setStatusState(s)
  }

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    if (statusRef.current !== 'dirty' && statusRef.current !== 'error') return
    const body = ref.current?.value ?? ''
    setStatus('saving')
    try {
      const r = await saveNote(code, body)
      if (!r) throw new Error('rejected')
      setSavedAt(new Date(r.savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }))
      // typing may have continued while the request was in flight
      setStatus(ref.current?.value === body ? 'saved' : 'dirty')
      if (ref.current?.value !== body) schedule()
    } catch {
      setStatus('error')
      timer.current = setTimeout(flush, 3000)
    }
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 800)
  }

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush() // leaving the page with a pending edit
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="mono-label text-muted">Note</span>
        <span className="text-xs text-muted">
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && (
            <>
              Saved{savedAt && <span className="font-mono"> {savedAt}</span>}
            </>
          )}
          {status === 'dirty' && 'Unsaved'}
          {status === 'error' && <span className="text-accent-deep">Not saved — retrying</span>}
        </span>
      </div>
      <textarea
        ref={ref}
        defaultValue={initialBody}
        aria-label="Note"
        placeholder="Markdown. Saves itself."
        onChange={() => {
          setStatus('dirty')
          schedule()
        }}
        onBlur={() => void flush()}
        className="min-h-[45vh] w-full resize-y rounded-btn border border-line bg-surface p-4 text-base leading-relaxed outline-none focus:border-ink"
      />
    </div>
  )
}
