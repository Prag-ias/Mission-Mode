/**
 * v4 acceptance spec: mock scoring, audit dashboard, CA capture, decay,
 * export, PWA offline read.
 *
 * Synthetic rows only: TEST-9x topics, a mock whose source carries a marker,
 * and CA items with a marker headline. Teardown removes exactly those.
 */
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const MOCK_MARKER = 'TEST-MOCK-V4'
const CA_MARKER = 'TEST-CA-V4'

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function removeFixtures() {
  await sql`delete from test_subjects where test_id in (select id from tests where source like ${MOCK_MARKER + '%'})`
  await sql`delete from tests where source like ${MOCK_MARKER + '%'}`
  await sql`delete from ca_items where headline like ${CA_MARKER + '%'}`
  await sql`delete from revision_events where topic_id in (select id from topics where code like 'TEST-9%')`
  await sql`delete from topics where code like 'TEST-9%'`
}

test.beforeAll(async () => {
  await removeFixtures()
  const [csat] = await sql`select id from subjects where code = 'CSAT'`
  // three read topics with stale touches and far-future D30 events — the raw
  // material the weak-subject push must act on
  for (const [i, code] of (['TEST-91', 'TEST-92', 'TEST-93'] as const).entries()) {
    const [t] = await sql`
      insert into topics (code, subject_id, name, source_ref, est_minutes, intro_phase, stage, last_touched_at, bonus)
      values (${code}, ${csat.id}, ${'TEST DECAY TOPIC ' + (i + 1)}, 'Test Source', 10, 1, 'read',
              now() - interval '40 days', false)
      returning id`
    await sql`insert into revision_events (topic_id, rung, due_on) values (${t.id}, 'D30', ${addDays(TODAY, 60)})`
  }
})

test.afterAll(async () => {
  await removeFixtures()
  await sql.end()
})

async function login(page: Page) {
  await page.goto('/')
  const pw = page.getByPlaceholder('Password')
  if (await pw.isVisible().catch(() => false)) {
    await pw.fill(APP_PASSWORD)
    await page.getByRole('button', { name: 'Enter' }).click()
  }
  await expect(page.getByTestId('footer')).toBeVisible()
}

test('mock entry: totals + per-subject rows save, auto-score, and land on the audit', async ({ page }) => {
  await login(page)
  await page.goto('/tests/new')

  await page.getByLabel('Source').fill(`${MOCK_MARKER} Forum sectional`)
  await page.locator('input[name="attempted"]').fill('90')
  await page.locator('input[name="correct"]').fill('50')

  // CSAT row below 60% — this is the row that must trigger the weak push
  await page.locator('input[name="s-CSAT-attempted"]').fill('20')
  await page.locator('input[name="s-CSAT-correct"]').fill('8')

  await page.getByRole('button', { name: 'Save mock' }).click()
  await page.waitForURL(/\/audit/, { timeout: 30_000 })

  const [t] = await sql`select attempted, correct, score from tests where source like ${MOCK_MARKER + '%'}`
  expect(t.attempted).toBe(90)
  expect(t.correct).toBe(50)
  // 50*2 - 40*(2/3) = 73.33
  expect(Number(t.score)).toBeCloseTo(73.33, 1)

  const subs = await sql`
    select ts.attempted, ts.correct from test_subjects ts
    join tests t on t.id = ts.test_id where t.source like ${MOCK_MARKER + '%'}`
  expect(subs).toHaveLength(1)
  expect(subs[0].attempted).toBe(20)
})

test('a subject below 60% pushes its three weakest topics due within seven days', async () => {
  const rows = await sql`
    select re.due_on::text as due from revision_events re
    join topics t on t.id = re.topic_id
    where t.code like 'TEST-9%' and re.completed_at is null`
  expect(rows).toHaveLength(3)
  for (const r of rows) {
    expect(r.due <= addDays(TODAY, 7)).toBe(true)
  }
})

test('audit answers "am I on track" on one screen', async ({ page }) => {
  await login(page)
  await page.goto('/audit')
  for (const id of ['audit-adherence', 'audit-coverage', 'audit-debt', 'audit-mocks', 'audit-reasons', 'audit-decay']) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
  // the mock just entered shows up against the 120 target
  await expect(page.getByTestId('audit-mocks')).toContainText('120')
})

test('CA capture: an item with topic tags surfaces on that topic page', async ({ page }) => {
  await login(page)
  await page.goto('/ca')
  await page.getByLabel('Headline').fill(`${CA_MARKER} Green hydrogen pilot expanded`)
  await page.getByLabel('One line').fill('Electrolyser capacity doubled at the Kochi plant.')
  await page.getByTestId('tag-input').fill('TEST-91')
  await page.getByTestId('tag-add').click()
  await page.getByRole('button', { name: 'Capture' }).click()

  await expect(page.getByText(`${CA_MARKER} Green hydrogen pilot expanded`)).toBeVisible()

  await page.goto('/topic/TEST-91')
  await expect(page.getByTestId('ca-list')).toContainText(CA_MARKER)
})

test('export returns the whole database as JSON', async ({ page }) => {
  await login(page)
  const res = await page.request.get('/api/export')
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.subjects).toHaveLength(11)
  expect(body.topics.length).toBeGreaterThanOrEqual(192)
  expect(body.questions.length).toBeGreaterThan(400)
  expect(body.plan_blocks.length).toBeGreaterThanOrEqual(912)
  expect(body.exported_at).toBeTruthy()
})

test('PWA: manifest and service worker are served; offline still shows Today', async ({ page, context }) => {
  const mf = await page.request.get('/manifest.webmanifest')
  expect(mf.ok()).toBe(true)
  const sw = await page.request.get('/sw.js')
  expect(sw.ok()).toBe(true)

  await login(page)
  // let the service worker install and populate its runtime cache
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, { timeout: 20_000 })
  await page.reload()
  await expect(page.getByTestId('footer')).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('footer')).toBeVisible({ timeout: 20_000 })
  await context.setOffline(false)
})

test('new routes hold at phone and desktop widths', async ({ page }) => {
  await login(page)
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h })
    for (const route of ['/audit', '/tests/new', '/ca', '/guide']) {
      await page.goto(route)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(overflow, `${route} at ${w}px scrolls sideways`).toBe(false)
    }
  }
})
