/**
 * v2 acceptance spec: the revision ladder engine, the queue, blind recall,
 * missed-block rescheduling.
 *
 * Synthetic rows only — topics TEST-02 and TESTQ-1..4, plan blocks in T-slots.
 * Real topics, blocks, notes and logs are never written. The one intended
 * side effect on real data (PASS2–4 events seeded for all topics by
 * `npm run seed`) is asserted read-only.
 */
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const SYNTH_CODES = ['TEST-02', 'TESTQ-1', 'TESTQ-2', 'TESTQ-3', 'TESTQ-4']

async function removeFixtures() {
  await sql`delete from revision_events where topic_id in (select id from topics where code = any(${SYNTH_CODES}))`
  await sql`delete from notes where topic_id in (select id from topics where code = any(${SYNTH_CODES}))`
  await sql`delete from plan_blocks where slot like 'T%'`
  await sql`delete from topics where code = any(${SYNTH_CODES})`
}

async function makeTopic(code: string, name: string) {
  const [csat] = await sql`select id from subjects where code = 'CSAT'`
  const [t] = await sql`
    insert into topics (code, subject_id, name, source_ref, est_minutes, intro_phase, stage)
    values (${code}, ${csat.id}, ${name}, 'Test Source', 10, 1, 'unread') returning id`
  return t.id as number
}

async function login(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('Password').fill(APP_PASSWORD)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByTestId('footer')).toBeVisible()
}

test.beforeAll(async () => {
  await removeFixtures()
})

test.afterAll(async () => {
  await removeFixtures()
  await sql.end()
})

test('PASS2–4 are seeded for every topic inside phase windows', async () => {
  const rows = await sql`
    select re.rung, count(*)::int as n, min(re.due_on)::text as lo, max(re.due_on)::text as hi
    from revision_events re join topics t on t.id = re.topic_id
    where re.rung in ('PASS2','PASS3','PASS4') and t.code not like 'TEST%'
    group by re.rung order by re.rung`
  expect(rows).toHaveLength(3)
  const windows: Record<string, [string, string]> = {
    PASS2: ['2027-02-15', '2027-04-04'],
    PASS3: ['2027-04-05', '2027-05-09'],
    PASS4: ['2027-05-10', '2027-05-23'],
  }
  for (const r of rows) {
    expect(r.n).toBe(186)
    const [lo, hi] = windows[r.rung]
    expect(String(r.lo) >= lo).toBe(true)
    expect(String(r.hi) <= hi).toBe(true)
  }
})

test('marking a topic read creates exactly four events, once', async ({ page }) => {
  await makeTopic('TEST-02', 'TEST LADDER TOPIC')
  await login(page)
  await page.goto('/topic/TEST-02')
  await page.getByRole('button', { name: 'read', exact: true }).click()
  await expect(page.getByTestId('stage-current')).toHaveText('read')

  const events = await sql`
    select rung, due_on::text as due from revision_events
    where topic_id = (select id from topics where code = 'TEST-02') order by due_on`
  expect(events.map((e) => e.rung)).toEqual(['D1', 'D7', 'D30', 'D90'])
  expect(events.map((e) => e.due)).toEqual([1, 7, 30, 90].map((n) => addDays(TODAY, n)))

  // bouncing the stage does not duplicate the ladder
  await page.getByRole('button', { name: 'reading' }).click()
  await page.getByRole('button', { name: 'read', exact: true }).click()
  const [{ n }] = await sql`
    select count(*)::int as n from revision_events
    where topic_id = (select id from topics where code = 'TEST-02')`
  expect(n).toBe(4)
})

test('queue: due items, most overdue first, capped at 12, debt shown', async ({ page }) => {
  // 4 topics × 4 rungs = 16 events all due — 12 visible, 4 debt
  for (let i = 1; i <= 4; i++) {
    const id = await makeTopic(`TESTQ-${i}`, `TEST QUEUE TOPIC ${i}`)
    await sql`update topics set stage = 'read' where id = ${id}`
    for (const [rung, ago] of [['D1', 10 + i], ['D7', 8], ['D30', 5], ['D90', 2]] as const) {
      await sql`insert into revision_events (topic_id, rung, due_on)
        values (${id}, ${rung}, ${addDays(TODAY, -ago)})`
    }
  }
  await login(page)
  await page.goto('/revise')

  await expect(page.locator('[data-testid^="queue-item-"]')).toHaveCount(12)
  await expect(page.getByTestId('revision-debt')).toContainText('4')
  // most overdue first: TESTQ-4's D1 is 14 days old
  await expect(page.locator('[data-testid^="queue-item-"]').first()).toContainText('TEST QUEUE TOPIC 4')
})

test('completing a non-D1 item advances the stage monotonically', async ({ page }) => {
  await login(page)
  await page.goto('/revise')
  // TESTQ topics are stage 'read'; completing their D30 must land on R3
  const item = page.getByTestId('queue-item-TESTQ-1-D30')
  await expect(item).toBeVisible()
  await item.getByRole('button', { name: 'Done' }).click()
  await expect(item).toHaveCount(0)

  const [t] = await sql`select stage from topics where code = 'TESTQ-1'`
  expect(t.stage).toBe('R3')
  const [e] = await sql`
    select completed_at from revision_events
    where topic_id = (select id from topics where code = 'TESTQ-1') and rung = 'D30'`
  expect(e.completed_at).not.toBeNull()
})

test('blind recall: note hidden, reveal on submit, score 1 shortens D7', async ({ page }) => {
  const [t] = await sql`select id from topics where code = 'TEST-02'`
  await sql`insert into notes (topic_id, body_md) values (${t.id}, 'SECRET-NOTE-CONTENT Article 32 writs')`
  // most overdue of all fixtures, so it is guaranteed inside the capped queue
  await sql`update revision_events set due_on = ${addDays(TODAY, -30)} where topic_id = ${t.id} and rung = 'D1'`

  await login(page)
  await page.goto('/revise')
  const item = page.getByTestId('queue-item-TEST-02-D1')
  await item.getByRole('link', { name: /recall/i }).click()

  // the note must not be on the page before submitting
  await expect(page.getByText('SECRET-NOTE-CONTENT')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'What do you remember' }).fill('fundamental rights, articles 12 to 18')
  await page.getByRole('button', { name: 'Reveal note' }).click()
  await expect(page.getByText(/SECRET-NOTE-CONTENT/)).toBeVisible()

  await page.getByRole('button', { name: '1', exact: true }).click()
  await expect(page).toHaveURL(/\/revise$/)

  const rows = await sql`
    select rung, recall_score, completed_at, due_on::text as due
    from revision_events where topic_id = ${t.id} and rung in ('D1','D7') order by rung`
  const d1 = rows.find((r) => r.rung === 'D1')!
  const d7 = rows.find((r) => r.rung === 'D7')!
  expect(d1.recall_score).toBe(1)
  expect(d1.completed_at).not.toBeNull()
  expect(d7.due).toBe(addDays(TODAY, 3)) // shortened from +7
  const [t2] = await sql`select stage from topics where code = 'TEST-02'`
  expect(t2.stage).toBe('R1')
})

test('missed blocks: carried twice, then debt cleared by hand', async ({ page }) => {
  const [csat] = await sql`select id from subjects where code = 'CSAT'`
  // missed yesterday → carried on Today; missed 4 days ago → debt on /revise
  await sql`insert into plan_blocks (date, slot, start, kind, phase_code, subject_id, label, planned_minutes, status)
    values (${addDays(TODAY, -1)}, 'T1', '19:00', 'deep', 'P0', ${csat.id}, 'TEST MISSED FRESH', 60, 'planned'),
           (${addDays(TODAY, -4)}, 'T2', '19:00', 'deep', 'P0', ${csat.id}, 'TEST MISSED OLD', 60, 'planned')`

  await login(page) // loading Today runs the sweep

  const fresh = page.getByTestId('block-T1')
  await expect(fresh).toBeVisible()
  await expect(fresh).toContainText(/owed/i)
  await expect(page.getByTestId('block-T2')).toHaveCount(0) // too old for Today

  const [b1] = await sql`select status, reschedule_count from plan_blocks where slot = 'T1' and date = ${addDays(TODAY, -1)}`
  expect(b1.status).toBe('rescheduled')
  expect(b1.reschedule_count).toBe(1)
  const [b2] = await sql`select status, reschedule_count from plan_blocks where slot = 'T2' and date = ${addDays(TODAY, -4)}`
  expect(b2.status).toBe('rescheduled')
  expect(b2.reschedule_count).toBe(2) // stops at two

  // the old one is block debt on /revise, cleared by hand
  await page.goto('/revise')
  const debt = page.getByTestId('block-debt-T2')
  await expect(debt).toContainText('TEST MISSED OLD')
  await debt.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByTestId('block-debt-T2')).toHaveCount(0)
  const [b3] = await sql`select status from plan_blocks where slot = 'T2' and date = ${addDays(TODAY, -4)}`
  expect(b3.status).toBe('skipped')
})

test('revision blocks on Today open the queue; footer shows debt', async ({ page }) => {
  const [csat] = await sql`select id from subjects where code = 'CSAT'`
  await sql`insert into plan_blocks (date, slot, start, kind, phase_code, label, planned_minutes, status)
    values (${TODAY}, 'T3', '21:40', 'revision', 'P0', 'Revision queue — most overdue first', 70, 'planned')`

  await login(page)
  const block = page.getByTestId('block-T3')
  await block.getByRole('link', { name: /Revision queue/ }).click()
  await expect(page).toHaveURL(/\/revise/)

  await page.goto('/')
  await expect(page.getByTestId('footer')).toContainText(/debt/)
})
