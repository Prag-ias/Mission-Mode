/**
 * Enrichment spec: manual dark mode, per-topic materials (links now, files
 * once the storage key exists), and the /api/material opener.
 *
 * Fixture: one TEST-M1 topic under CSAT. Teardown removes its materials and
 * the topic itself — nothing real is touched.
 */
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

async function removeFixtures() {
  await sql`delete from topic_materials where topic_id in (select id from topics where code = 'TEST-M1')`
  await sql`delete from revision_events where topic_id in (select id from topics where code = 'TEST-M1')`
  await sql`delete from topics where code = 'TEST-M1'`
}

test.beforeAll(async () => {
  await removeFixtures()
  const [csat] = await sql`select id from subjects where code = 'CSAT'`
  await sql`
    insert into topics (code, subject_id, name, source_ref, est_minutes, intro_phase, stage, bonus)
    values ('TEST-M1', ${csat.id}, 'TEST MATERIALS TOPIC', 'Test Source', 10, 1, 'unread', false)`
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

test('dark mode is a manual flip that survives reload', async ({ page }) => {
  await login(page)

  await page.getByTestId('guide-menu').click()
  await page.getByTestId('theme-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // the body actually paints dark, not just the attribute
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(19, 21, 25)')

  await page.getByTestId('guide-menu').click()
  await page.getByTestId('theme-toggle').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
})

test('a pasted link lands on the topic page and deletes cleanly', async ({ page }) => {
  await login(page)
  await page.goto('/topic/TEST-M1')

  const materials = page.getByTestId('materials')
  await expect(materials).toBeVisible()
  await expect(materials).toContainText('Nothing attached')

  await materials.getByText('Add material').click()
  await materials.locator('input[name="title"]').fill('TEST NCERT chapter')
  await materials.locator('input[name="url"]').fill('https://example.org/ncert-ch4')
  await materials.getByRole('button', { name: 'Add link' }).click()

  await expect(materials.getByText('TEST NCERT chapter')).toBeVisible()

  // the opener redirects a link row straight to its URL
  const [row] = await sql`
    select tm.id from topic_materials tm
    join topics t on t.id = tm.topic_id where t.code = 'TEST-M1'`
  const res = await page.request.get(`/api/material/${row.id}`, { maxRedirects: 0 })
  expect(res.status()).toBe(307)
  expect(res.headers()['location']).toBe('https://example.org/ncert-ch4')

  await materials.getByRole('button', { name: 'Remove TEST NCERT chapter' }).click()
  await expect(materials.getByText('TEST NCERT chapter')).not.toBeVisible()
  await expect(materials).toContainText('Nothing attached')
})

test('sheet-synced refs render read-only, with no delete control', async ({ page }) => {
  const [topic] = await sql`select id from topics where code = 'TEST-M1'`
  await sql`
    insert into topic_materials (topic_id, kind, source, title, url)
    values (${topic.id}, 'link', 'sheet', 'TEST SHEET REF', 'https://example.org/ref')`

  await login(page)
  await page.goto('/topic/TEST-M1')
  const materials = page.getByTestId('materials')
  await expect(materials.getByText('TEST SHEET REF')).toBeVisible()
  await expect(materials.getByText('ref', { exact: true })).toBeVisible()
  await expect(materials.getByRole('button', { name: 'Remove TEST SHEET REF' })).toHaveCount(0)
})
