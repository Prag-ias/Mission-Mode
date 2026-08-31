import Link from 'next/link'

/**
 * The way out of a deep screen. A real 44px tap target, not a text link —
 * at 21:40 the exit has to be findable without looking for it.
 */
export default function BackLink({
  href,
  label,
  testId = 'back',
}: {
  href: string
  label: string
  testId?: string
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-btn px-2 text-sm font-medium text-muted active:bg-surface lg:hover:bg-surface lg:hover:text-ink"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </Link>
  )
}
