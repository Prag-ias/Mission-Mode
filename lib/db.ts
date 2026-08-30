import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

/**
 * prepare: false — Supabase's transaction pooler (pgbouncer) can't take
 * prepared statements.
 *
 * max: 10 — v0 ran on a single connection; every page now issues several
 * queries, and the bottom nav's prefetching means bursts arrive together.
 * Ten is still tiny for Supabase's pooler and costs nothing when idle.
 * Large fan-outs (export, audit) stay sequential regardless: Promise.all
 * bursts past the pool size have wedged this driver twice now.
 *
 * The timeouts matter more than the size: without them a connection that stalls
 * wedges the app until the process restarts, which is exactly the failure this
 * had. connect_timeout gives up on a dead connection, idle_timeout returns idle
 * ones to the pooler so it can recycle them.
 */
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> }

const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client

export const db = drizzle(client, { schema })
