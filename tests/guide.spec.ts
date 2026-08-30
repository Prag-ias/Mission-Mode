/**
 * Guide spec: the top-right menu, the day-synced routine, and book tracking.
 * Book status is real user data — the toggle test records the original value
 * and restores it exactly.
 */
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''
const sql = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, ssl: 'require' })

test.afterAll(async () => {
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

test('the top-right menu opens and reaches the guide', async ({ page }) => {
  await login(page)
  await page.getByTestId('guide-menu').click()
  await expect(page.getByTestId('guide-dropdown')).toBeVisible()
  await page.getByRole('link', { name: /routine/i }).click()
  await page.waitForURL(/\/guide/, { timeout: 30_000 })
  await expect(page.getByTestId('routine-list')).toBeVisible()
})

test('the routine is synced to today', async ({ page }) => {
  const dow = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' })
      .format(new Date())
      .match(/Sun/) ? 0 : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay(),
  )
  await login(page)
  await page.goto('/guide')

  if (dow === 0) {
    await expect(page.getByText('Sunday · Test & audit')).toBeVisible()
    await expect(page.getByText('Full mock — exam timing')).toBeVisible()
  } else if (dow === 6) {
    await expect(page.getByText('Saturday · Build day')).toBeVisible()
    await expect(page.getByText(/Sociology — the whole slot|Optional \(Sociology\)/)).toBeVisible()
  } else {
    await expect(page.getByText('Weekday · Mon–Fri')).toBeVisible()
    await expect(page.getByText('Block B — 120 min')).toBeVisible()
    await expect(page.getByText('No new material after 21:40.')).toBeVisible()
  }
  // the books section is on the same page
  await expect(page.getByText('The list, and what it costs')).toBeVisible()
  await expect(page.getByText('Indian Polity — M. Laxmikanth')).toBeVisible()
})

test('book status toggles, persists, and is restored', async ({ page }) => {
  const [book] = await sql`select id, status from books where title = 'Oxford Student Atlas for India'`
  expect(book).toBeTruthy()
  const original = book.status as string
  const target = original === 'owned' ? 'to_buy' : 'owned'

  await login(page)
  await page.goto('/guide')
  await page.getByTestId(`book-${book.id}-${target}`).click()

  await expect(page.getByTestId(`book-${book.id}-${target}`)).toBeDisabled()
  const [after] = await sql`select status from books where id = ${book.id}`
  expect(after.status).toBe(target)

  // restore the user's real value exactly
  await sql`update books set status = ${original} where id = ${book.id}`
})
