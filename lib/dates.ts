/**
 * All "today" logic runs in IST (Asia/Kolkata), never in server time.
 * Vercel runs UTC, and the IST date differs from the UTC date between
 * 00:00 and 05:30 IST — exactly the window in which Block A is looked at.
 */
const TZ = 'Asia/Kolkata'

export const EXAM_DATE = '2027-05-23'

export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromISO: string, toISO: string): number {
  const ms = new Date(toISO + 'T00:00:00Z').getTime() - new Date(fromISO + 'T00:00:00Z').getTime()
  return Math.round(ms / 86_400_000)
}

/** "Sunday 30 Aug" */
export function displayDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso + 'T00:00:00Z'))
}
