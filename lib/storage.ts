/**
 * Supabase Storage over plain REST — no SDK dependency for one bucket.
 *
 * Uploads live in the private `materials` bucket and are served through
 * short-lived signed URLs, so a leaked link dies in an hour. Everything is
 * gated on SUPABASE_SERVICE_KEY: until the key is in the env, storageReady()
 * is false and the upload UI stays disabled instead of half-working.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zjrkbmljishntzgexmaw.supabase.co'
const BUCKET = 'materials'

const key = () => process.env.SUPABASE_SERVICE_KEY

export function storageReady(): boolean {
  return !!key()
}

function headers(extra: Record<string, string> = {}) {
  const k = key()
  if (!k) throw new Error('SUPABASE_SERVICE_KEY is not set')
  return { Authorization: `Bearer ${k}`, apikey: k, ...extra }
}

/** Creates the bucket if it does not exist; a 409 means it already does. */
async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  })
  if (!res.ok && res.status !== 409) {
    const body = await res.text()
    if (!body.includes('already exists')) throw new Error(`bucket create failed: ${res.status} ${body}`)
  }
}

export async function uploadObject(path: string, bytes: ArrayBuffer, contentType: string) {
  await ensureBucket()
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: bytes,
  })
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`)
}

export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  })
  if (!res.ok) throw new Error(`sign failed: ${res.status} ${await res.text()}`)
  const { signedURL } = (await res.json()) as { signedURL: string }
  return `${SUPABASE_URL}/storage/v1${signedURL}`
}

export async function removeObject(path: string) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE',
    headers: headers(),
  })
  // 404 is fine — deleting a row whose file is already gone should not error
  if (!res.ok && res.status !== 404) throw new Error(`remove failed: ${res.status} ${await res.text()}`)
}
