/**
 * v0 acceptance spec. Runs against a real database seeded from seed/*.json.
 *
 * The plan holds no blocks for dates before 31 Aug 2026, and Playwright cannot
 * time-travel the app's IST clock, so the logging flow is exercised on two
 * throwaway blocks (slots T1/T2) inserted for today and removed afterwards.
 * Slots T1/T2 are never produced by the planner, so this is safe on any date.
 * The 31 Aug content itself is asserted directly against the database.
 */
import { expect, test } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const TZ_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

const TEST_BLOCKS = [
  { slot: 'T1', start: '05:30', minutes: 90, label: 'TEST BLOCK ALPHA' },
  { slot: 'T2', start: '19:00', minutes: 90, label: 'TEST BLOCK BETA' },
]

async function removeTestBlocks() {
  await sql`delete from plan_blocks where date = ${TZ_TODAY} and slot in ('T1', 'T2')`
  // Rebuild today's daily_logs from whatever real done blocks remain, exactly
  // as the app does, so running this spec never corrupts a live day.
  const [{ total }] = await sql`
    select coalesce(sum(actual_minutes), 0)::int as total
    from plan_blocks where date = ${TZ_TODAY} and status = 'done'`
  if (total === 0) {
    await sql`delete from daily_logs where date = ${TZ_TODAY}`
  } else {
    const mvd = total >= 160
    const [prev] = await sql`
      select mvd_met, streak_count from daily_logs
      where date = ${TZ_TODAY}::date - 1`
    const streak = mvd ? (prev?.mvd_met ? prev.streak_count : 0) + 1 : 0
    await sql`
      update daily_logs set total_minutes = ${total}, mvd_met = ${mvd}, streak_count = ${streak}
      where date = ${TZ_TODAY}`
  }
}

test.beforeAll(async () => {
  await removeTestBlocks()
  for (const b of TEST_BLOCKS) {
    await sql`
      insert into plan_blocks (date, slot, start, kind, phase_code, label, planned_minutes, status)
      values (${TZ_TODAY}, ${b.slot}, ${b.start}, 'deep', 'P0', ${b.label}, ${b.minutes}, 'planned')`
  }
})

test.afterAll(async () => {
  await removeTestBlocks()
  await sql.end()
})

test('seed loaded the real content, including Monday 31 Aug', async () => {
  const [counts] = await sql`
    select
      (select count(*) from subjects)::int    as subjects,
      (select count(*) from topics where bonus = false)::int as topics,
      (select count(*) from phases)::int      as phases,
      (select count(*) from plan_blocks where slot not in ('T1','T2'))::int as blocks`
  expect(counts).toEqual({ subjects: 11, topics: 186, phases: 7, blocks: 912 })

  const day1 = await sql`
    select slot, start, label, source_ref from plan_blocks
    where date = '2026-08-31' and slot not in ('T1', 'T2') order by start`
  expect(day1).toHaveLength(3)
  expect(day1[0]).toMatchObject({ slot: 'A', start: '05:30', source_ref: 'NCERT 11 Fund. Ch.1–3' })
  expect(day1[0].label).toContain('Universe')
  expect(day1[1]).toMatchObject({ slot: 'B', start: '19:00', source_ref: 'Laxmikanth Ch.1' })
  expect(day1[2].slot).toBe('C')
  expect(day1[2].start).toBe('21:40')
  expect(day1[2].label).toContain('Revision queue')
})

test('password gate: wrong rejected, right enters', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByPlaceholder('Password')).toBeVisible()

  await page.getByPlaceholder('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByText('Wrong password.')).toBeVisible()

  await page.getByPlaceholder('Password').fill(APP_PASSWORD)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByTestId('footer')).toBeVisible()
})

test('blocks render, log, persist; MVD flips at 160; streak counts', async ({ page }) => {
  // The app is in live daily use: real blocks may already be logged today, so
  // every footer assertion is relative to that baseline, never absolute.
  const [{ base }] = await sql`
    select coalesce(sum(actual_minutes), 0)::int as base from plan_blocks
    where date = ${TZ_TODAY} and status = 'done' and slot not in ('T1', 'T2')`
  const mvd = (total: number) => (total >= 160 ? 'MVD met' : `MVD ${total}/160`)

  await page.goto('/')
  await page.getByPlaceholder('Password').fill(APP_PASSWORD)
  await page.getByRole('button', { name: 'Enter' }).click()

  const t1 = page.getByTestId('block-T1')
  const t2 = page.getByTestId('block-T2')
  const footer = page.getByTestId('footer')

  // Both cards visible with label as the heading, time and planned minutes
  await expect(t1.getByRole('heading', { name: 'TEST BLOCK ALPHA' })).toBeVisible()
  await expect(t1).toContainText('05:30')
  await expect(t2.getByRole('heading', { name: 'TEST BLOCK BETA' })).toBeVisible()
  await expect(footer).toContainText(mvd(base))

  // Log T1 with the pre-filled planned minutes (90) — below the MVD floor
  await expect(t1.getByRole('spinbutton')).toHaveValue('90')
  await t1.getByRole('button', { name: 'Done' }).click()
  await expect(t1).toContainText('Block T1 — 90 min')
  await expect(footer).toContainText(mvd(base + 90))

  // A done block recedes but stays on screen, in place
  await expect(t1.getByRole('button', { name: 'Done' })).toHaveCount(0)
  await expect(t1.getByRole('heading', { name: 'TEST BLOCK ALPHA' })).toBeVisible()

  // Log T2 with edited minutes — crosses 160, MVD met, streak >= 1
  await t2.getByRole('spinbutton').fill('95')
  await t2.getByRole('button', { name: 'Done' }).click()
  await expect(t2).toContainText('Block T2 — 95 min')
  await expect(footer).toContainText('MVD met')
  await expect(footer).toContainText(/streak [1-9]\d* d/)

  // Survives a reload — state is in Postgres, not the page
  await page.reload()
  await expect(t1).toContainText('Block T1 — 90 min')
  await expect(t2).toContainText('Block T2 — 95 min')
  await expect(footer).toContainText('MVD met')

  // daily_logs row is really there
  const [log] = await sql`select total_minutes, mvd_met from daily_logs where date = ${TZ_TODAY}`
  expect(log.total_minutes).toBe(base + 185)
  expect(log.mvd_met).toBe(true)

  // fix: correct a mis-entry without leaving the screen
  await t1.getByRole('button', { name: 'fix' }).click()
  await t1.getByRole('spinbutton').fill('100')
  await t1.getByRole('button', { name: 'Done' }).click()
  await expect(t1).toContainText('Block T1 — 100 min')
  await expect(footer).toContainText(`${base + 195} min`)
})
