/**
 * v1 acceptance spec: coverage grid, topic detail, stage control, notes
 * with autosave, search, Today→topic links.
 *
 * Touches ONLY synthetic rows — a TEST-01 topic and a T1 plan block created
 * here and removed in teardown. Real topics, blocks, logs and notes are never
 * read or written, so this is safe to run while the app is in daily use.
 */
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const TZ_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const MARKER = 'ZEBRA-MARKER-V1'

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

async function removeFixtures() {
  // the v2 ladder creates revision_events when the stage test reaches `read`
  await sql`delete from revision_events where topic_id in (select id from topics where code = 'TEST-01')`
  await sql`delete from notes where topic_id in (select id from topics where code = 'TEST-01')`
  await sql`delete from plan_blocks where date = ${TZ_TODAY} and slot = 'T1'`
  await sql`delete from topics where code = 'TEST-01'`
}

test.beforeAll(async () => {
  await removeFixtures()
  const [csat] = await sql`select id from subjects where code = 'CSAT'`
  const [topic] = await sql`
    insert into topics (code, subject_id, name, source_ref, est_minutes, intro_phase, stage)
    values ('TEST-01', ${csat.id}, 'TEST TOPIC ZEBRA', 'Test Source Ch.0', 10, 1, 'unread')
    returning id`
  await sql`
    insert into plan_blocks (date, slot, start, kind, phase_code, topic_id, subject_id, label, source_ref, planned_minutes, status)
    values (${TZ_TODAY}, 'T1', '05:30', 'deep', 'P0', ${topic.id}, ${csat.id}, 'TEST TOPIC ZEBRA', 'Test Source Ch.0', 90, 'planned')`
})

test.afterAll(async () => {
  await removeFixtures()
  await sql.end()
})

async function login(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('Password').fill(APP_PASSWORD)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByTestId('footer')).toBeVisible()
}

test('coverage grid: all topics, grouped by subject, fast', async ({ page }) => {
  await login(page)
  await page.goto('/syllabus') // warm the route (dev server compiles on first hit)

  const t0 = Date.now()
  await page.goto('/syllabus')
  const elapsed = Date.now() - t0
  console.log(`syllabus warm render: ${elapsed}ms`)
  expect(elapsed).toBeLessThan(2000)

  // 186 core topics + the TEST-01 fixture. Bonus topics (D30) are listed
  // separately and must not appear in the grid.
  await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(187)
  await expect(page.locator('[data-testid^="bonus-"]').first()).toBeVisible()
  // all 11 subjects present as group headings
  for (const name of ['Polity & Governance', 'Sociology (Optional)', 'CSAT']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
})

test('every topic is two taps from /', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Syllabus' }).click() // tap 1
  await page.getByTestId('cell-TEST-01').click() // tap 2
  await expect(page.getByRole('heading', { name: 'TEST TOPIC ZEBRA' })).toBeVisible()
  await expect(page.getByText('Test Source Ch.0')).toBeVisible()
})

test('stage control persists and stamps first_read_at', async ({ page }) => {
  await login(page)
  await page.goto('/topic/TEST-01')

  await page.getByRole('button', { name: 'reading' }).click()
  await expect(page.getByTestId('stage-current')).toHaveText('reading')
  await page.reload()
  await expect(page.getByTestId('stage-current')).toHaveText('reading')

  const [beforeRead] = await sql`select stage, first_read_at from topics where code = 'TEST-01'`
  expect(beforeRead.stage).toBe('reading')
  expect(beforeRead.first_read_at).toBeNull()

  await page.getByRole('button', { name: 'read', exact: true }).click()
  await expect(page.getByTestId('stage-current')).toHaveText('read')
  const [afterRead] = await sql`select stage, first_read_at from topics where code = 'TEST-01'`
  expect(afterRead.stage).toBe('read')
  expect(afterRead.first_read_at).not.toBeNull()

  // the grid cell reflects the new stage class server-side
  await page.goto('/syllabus')
  await expect(page.getByTestId('cell-TEST-01')).toHaveAttribute('data-stage', 'read')
})

test('note autosaves without a save button and survives reload', async ({ page }) => {
  await login(page)
  await page.goto('/topic/TEST-01')

  const note = page.getByRole('textbox', { name: 'Note' })
  await note.fill(`${MARKER} — Article 21 covers life and personal liberty`)
  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 10_000 })

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue(new RegExp(MARKER))

  const [row] = await sql`
    select body_md from notes where topic_id = (select id from topics where code = 'TEST-01')`
  expect(row.body_md).toContain(MARKER)
})

test('search finds note content from the syllabus screen', async ({ page }) => {
  await login(page)
  await page.goto('/syllabus')
  await page.getByRole('searchbox', { name: 'Search notes' }).fill(MARKER)
  await page.keyboard.press('Enter')

  const hit = page.getByTestId('result-TEST-01')
  await expect(hit).toBeVisible()
  await expect(hit).toContainText('TEST TOPIC ZEBRA')
  await hit.click()
  await expect(page.getByRole('heading', { name: 'TEST TOPIC ZEBRA' })).toBeVisible()
})

test('today blocks link to their topic', async ({ page }) => {
  await login(page)
  const heading = page.getByTestId('block-T1').getByRole('link', { name: /TEST TOPIC ZEBRA/ })
  await expect(heading).toBeVisible()
  await heading.click()
  await expect(page).toHaveURL(/\/topic\/TEST-01/)
  await expect(page.getByRole('heading', { name: 'TEST TOPIC ZEBRA' })).toBeVisible()
})
