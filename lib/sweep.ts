import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { todayIST } from '@/lib/dates'

/**
 * Missed-block sweep, run on page load. Derives everything from dates so it
 * is idempotent: a planned block whose day has passed becomes `rescheduled`,
 * and reschedule_count tracks the days missed, capping at 2 (decision D4 —
 * after two carries it is debt, cleared by hand on /revise).
 */
export async function sweepMissedBlocks(): Promise<void> {
  const today = todayIST()
  await db.execute(sql`
    update plan_blocks
    set status = 'rescheduled',
        reschedule_count = least(2, (${today}::date - date))
    where date < ${today}::date
      and status in ('planned', 'rescheduled')
      and reschedule_count < least(2, (${today}::date - date))`)
}
