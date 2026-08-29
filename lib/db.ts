import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

// prepare: false — Supabase's transaction pooler (pgbouncer) can't take prepared
// statements. max: 1 — a single user never needs more than one connection per
// serverless instance. The globalThis cache stops dev HMR from piling up clients.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> }

const client =
  globalForDb.pgClient ?? postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1 })

if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client

export const db = drizzle(client, { schema })
