import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { todayIST } from '@/lib/dates'

/**
 * Missed-block sweep, run on page load. Derives everything from dates so it is
 * idempotent: a planned block whose day has passed becomes `rescheduled`, and
 * reschedule_count tracks the days missed, capping at 2 (decision D4).
 *
 * The check-then-write split matters: this used to fire an UPDATE on every
 * render of Today and Revise, taking a write lock and a WAL record just to
 * discover there was nothing to do. On the overwhelming majority of loads
 * there is nothing to sweep, so a cheap COUNT short-circuits it.
 */
export async function sweepMissedBlocks(): Promise<void> {
  const today = todayIST()
  const rows = await db.execute(sql`
    select 1 from plan_blocks
    where date < ${today}::date
      and status in ('planned', 'rescheduled')
      and reschedule_count < least(2, (${today}::date - date))
    limit 1`)
  if ((rows as unknown as unknown[]).length === 0) return

  await db.execute(sql`
    update plan_blocks
    set status = 'rescheduled',
        reschedule_count = least(2, (${today}::date - date))
    where date < ${today}::date
      and status in ('planned', 'rescheduled')
      and reschedule_count < least(2, (${today}::date - date))`)
}
