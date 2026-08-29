/**
 * The entire auth story: one password in SARTHI_PASSWORD, its SHA-256 in a
 * cookie. No auth library, no users table.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE = 'sarthi_auth'

const hash = (s: string) => createHash('sha256').update(s).digest('hex')

function expectedToken(): string | null {
  const pw = process.env.SARTHI_PASSWORD
  return pw ? hash(pw) : null
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function passwordMatches(pw: string): boolean {
  const expected = expectedToken()
  return expected !== null && safeEqual(hash(pw), expected)
}

export async function isAuthed(): Promise<boolean> {
  const expected = expectedToken()
  if (!expected) return false
  const value = (await cookies()).get(COOKIE)?.value
  return value !== undefined && safeEqual(value, expected)
}

export async function setAuthCookie(): Promise<void> {
  const expected = expectedToken()
  if (!expected) return
  ;(await cookies()).set(COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 400, // browser cap; well past 23 May 2027
  })
}
