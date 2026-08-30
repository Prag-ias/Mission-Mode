import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

/**
 * prepare: false — Supabase's transaction pooler (pgbouncer) can't take
 * prepared statements.
 *
 * max: 4 — v0 ran on a single connection because there was one page firing one
 * query. Every page now issues several queries through Promise.all, and with a
 * pool of one a single slow query blocks every other request behind it with no
 * way to recover. Four is still tiny (Supabase's pooler allows far more) and
 * costs nothing when idle.
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
    max: 4,
    idle_timeout: 20,
    connect_timeout: 15,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client

export const db = drizzle(client, { schema })
