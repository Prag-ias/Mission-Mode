'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The app's only navigation. Four destinations, fixed to the bottom on a phone
 * where the thumb is, and to the top on a laptop where a bottom bar would float
 * oddly over a wide page.
 *
 * Icons are inline strokes rather than an icon package: four glyphs do not
 * justify a dependency, and these inherit currentColor so they follow the theme.
 */
const TABS = [
  {
    href: '/',
    label: 'Today',
    // calendar
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    href: '/revise',
    label: 'Revise',
    // circular arrows
    icon: (
      <>
        <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.5-4" />
        <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.5 4" />
        <path d="M20 3v5h-5M4 21v-5h5" />
      </>
    ),
  },
  {
    href: '/practice',
    label: 'Practice',
    // target
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.4" />
      </>
    ),
  },
  {
    href: '/syllabus',
    label: 'Syllabus',
    // grid
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname() ?? '/'

  // The runner is a focused flow; chrome would only invite leaving it half done.
  if (pathname.startsWith('/practice/run')) return null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur lg:inset-x-auto lg:bottom-auto lg:top-0 lg:w-full lg:border-b lg:border-t-0"
    >
      <ul className="mx-auto flex max-w-md items-stretch lg:max-w-5xl lg:justify-start lg:gap-1 lg:px-8">
        {TABS.map((t) => {
          const active = isActive(t.href)
          return (
            <li key={t.href} className="flex-1 lg:flex-none">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                data-testid={`nav-${t.label.toLowerCase()}`}
                className={`flex flex-col items-center gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 transition lg:flex-row lg:gap-2 lg:px-3 lg:py-3.5 ${
                  active ? 'text-accent-deep' : 'text-muted lg:hover:text-ink'
                }`}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.1 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6 lg:size-5"
                >
                  {t.icon}
                </svg>
                <span className={`text-[11px] lg:text-sm ${active ? 'font-semibold' : 'font-medium'}`}>
                  {t.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
