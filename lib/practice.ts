/**
 * Practice batch selection.
 *
 * A batch has to stay stable while you walk through it, but storing sessions
 * server-side for one user is overkill. Instead the batch is derived: the
 * filters plus a seed in the URL pick a deterministic pseudo-random slice, so
 * the same URL always yields the same questions in the same order.
 */
export type Filters = {
  /** CSAT is only qualifying; GS1 is where marks are won, so it is the default
   *  pool and CSAT has to be asked for. Always set — never undefined. */
  paper: 'GS1' | 'CSAT'
  subject?: string
  topic?: string
  year?: number
  format?: string
  wrong?: boolean
  disputed?: boolean
  n: number
  seed: string
}

export const BATCH_SIZES = [10, 20] as const
export const CONFIDENCE = ['sure', 'unsure', 'guess'] as const
export type Confidence = (typeof CONFIDENCE)[number]

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined
  const n = Number(one('n'))
  const year = Number(one('year'))
  return {
    paper: one('paper') === 'CSAT' ? 'CSAT' : 'GS1',
    subject: one('subject') || undefined,
    topic: one('topic') || undefined,
    year: Number.isInteger(year) && year > 2000 ? year : undefined,
    format: one('format') || undefined,
    wrong: one('wrong') === '1',
    disputed: one('disputed') === '1',
    n: Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 20,
    seed: one('seed') || 'a',
  }
}

export function filterQuery(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.paper === 'CSAT') p.set('paper', 'CSAT')
  if (f.subject) p.set('subject', f.subject)
  if (f.topic) p.set('topic', f.topic)
  if (f.year) p.set('year', String(f.year))
  if (f.format) p.set('format', f.format)
  if (f.wrong) p.set('wrong', '1')
  if (f.disputed) p.set('disputed', '1')
  p.set('n', String(f.n))
  p.set('seed', f.seed)
  return p
}

/** A fresh seed for the next batch — short, URL-safe, no Math.random needed at render. */
export function nextSeed(current: string): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let h = 0
  for (let i = 0; i < current.length; i++) h = (h * 31 + current.charCodeAt(i)) >>> 0
  h = (h + Date.now()) >>> 0
  let out = ''
  for (let i = 0; i < 4; i++) { out += alphabet[h % alphabet.length]; h = Math.floor(h / alphabet.length) + 7 }
  return out
}
