'use client'

import { useEffect, useState } from 'react'

const KEY = 'sarthi-theme'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark')
  }, [])

  function flip() {
    const next = !dark
    setDark(next)
    if (next) document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light')
    } catch {}
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next ? '#131519' : '#fafaf7')
  }

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={flip}
      className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3.5 text-sm font-medium active:bg-bg lg:hover:bg-bg"
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4.5 text-muted">
        {dark ? (
          <circle cx="12" cy="12" r="5" />
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
        {dark && <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />}
      </svg>
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
