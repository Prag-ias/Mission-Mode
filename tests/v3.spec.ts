/**
 * v3 acceptance spec: practice mode, confidence before reveal, the mistake log,
 * ladder feedback and disputed handling.
 *
 * Uses the real question bank read-only, and writes only `attempts`, which the
 * teardown removes. No question, topic or plan row is created or modified.
 */
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

/** Attempts made by this spec, so teardown removes exactly those. */
const before = { at: new Date().toISOString() }

test.afterAll(async () => {
  await sql`delete from attempts where attempted_at >= ${before.at}`
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

test('bank is loaded and reachable from Today', async ({ page }) => {
  const [{ n }] = await sql`select count(*)::int n from questions`
  expect(n).toBeGreaterThan(400)

  await login(page)
  await page.getByRole('link', { name: /Practice/i }).click()
  await page.waitForURL(/\/practice/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Practice/i })).toBeVisible()
})

test('a batch runs one question at a time and ends in a summary, not a dead end', async ({ page }) => {
  await login(page)
  await page.goto('/practice?n=3&subject=POL')

  await page.getByRole('link', { name: /Start/i }).click()
  // dev compiles /practice/run on first hit, which can outrun the default wait
  await page.waitForURL(/\/practice\/run/, { timeout: 30_000 })

  for (let i = 1; i <= 3; i++) {
    await expect(page.getByTestId('progress')).toContainText(`${i} of 3`)
    // confidence must be chosen before the answer can be revealed
    await expect(page.getByTestId('reveal')).toBeDisabled()
    await page.getByRole('button', { name: 'sure', exact: true }).click()
    await page.getByTestId('option-a').click()
    await expect(page.getByTestId('reveal')).toBeEnabled()
    await page.getByTestId('reveal').click()

    await expect(page.getByTestId('verdict')).toBeVisible()
    await expect(page.getByTestId('explanation')).toBeVisible()

    // a wrong answer cannot be passed without a reason code
    const wrong = await page.getByTestId('verdict').getAttribute('data-correct')
    if (wrong === 'false') {
      await expect(page.getByTestId('next')).toBeDisabled()
      await page.getByTestId('reason-3').click()
    }
    await page.getByTestId('next').click()
  }

  await expect(page.getByTestId('summary')).toBeVisible()
  await expect(page.getByTestId('summary')).toContainText('3')
  await expect(page.getByRole('link', { name: /Another batch/i })).toBeVisible()
})

test('every attempt records confidence, and a wrong one records its reason', async () => {
  const rows = await sql`
    select chosen, is_correct, confidence, reason_code from attempts
    where attempted_at >= ${before.at}`
  expect(rows.length).toBe(3)
  for (const r of rows) {
    expect(['sure', 'unsure', 'guess']).toContain(r.confidence)
    if (r.is_correct) expect(r.reason_code).toBeNull()
    else expect(r.reason_code).not.toBeNull()
  }
})

test('the format filter isolates the three formats 2026 introduced', async ({ page }) => {
  await login(page)
  for (const fmt of ['relationship', 'conclusion_count', 'case_study']) {
    const [{ n }] = await sql`select count(*)::int n from questions where format = ${fmt}`
    expect(n).toBeGreaterThan(0)
    await page.goto(`/practice?format=${fmt}&n=1`)
    await expect(page.getByTestId('pool-size')).toContainText(String(n))
  }
})

test('disputed questions are practised but carry a badge', async ({ page }) => {
  const [d] = await sql`select year, q_no from questions where disputed = true limit 1`
  expect(d).toBeTruthy()
  await login(page)
  await page.goto(`/practice?disputed=1&n=1`)
  await page.getByRole('link', { name: /Start/i }).click()
  await page.waitForURL(/\/practice\/run/, { timeout: 30_000 })
  await expect(page.getByTestId('disputed-badge')).toBeVisible()
})

test('desktop and mobile both lay out without horizontal overflow', async ({ page }) => {
  await login(page)
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h })
    for (const route of ['/', '/syllabus', '/practice', '/revise']) {
      await page.goto(route)
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      expect(overflow, `${route} at ${w}px scrolls sideways`).toBe(false)
    }
  }
})
