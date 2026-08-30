'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * The top-right menu: today's routine and the book list, one tap away from
 * anywhere. Floats over the page on the phone; sits at the right end of the
 * top bar on a laptop.
 */
export default function GuideMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="fixed right-3 top-3 z-40 lg:right-6 lg:top-2">
      <button
        type="button"
        data-testid="guide-menu"
        aria-label="Guide menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-full border border-line bg-surface/95 text-muted shadow-s backdrop-blur transition active:bg-bg lg:hover:text-ink"
      >
        {/* open book */}
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M12 6c-1.5-1.6-3.6-2.4-6-2.4-1 0-2 .15-3 .45V19c1-.3 2-.45 3-.45 2.4 0 4.5.8 6 2.4 1.5-1.6 3.6-2.4 6-2.4 1 0 2 .15 3 .45V4.05c-1-.3-2-.45-3-.45-2.4 0-4.5.8-6 2.4Z" />
          <path d="M12 6v15" />
        </svg>
      </button>

      {open && (
        <nav
          data-testid="guide-dropdown"
          className="absolute right-0 top-12 w-56 overflow-hidden rounded-card border border-line bg-surface shadow-m"
        >
          <Link
            href="/guide#routine"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3.5 text-sm font-medium active:bg-bg lg:hover:bg-bg"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-4.5 text-muted">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            Today&rsquo;s routine
          </Link>
          <Link
            href="/guide#books"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-t border-line px-4 py-3.5 text-sm font-medium active:bg-bg lg:hover:bg-bg"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4.5 text-muted">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" />
              <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
            </svg>
            Books &amp; materials
          </Link>
        </nav>
      )}
    </div>
  )
}
