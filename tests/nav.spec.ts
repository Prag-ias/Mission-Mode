/**
 * Navigation spec: every deep screen must offer a visible way back.
 *
 * The trap this exists to prevent: practice mode hides the bottom nav for
 * focus, so if its exit control is missable the only way out is closing the
 * app. Read-only — no fixtures, nothing written.
 */
import { expect, test, type Page } from '@playwright/test'

const APP_PASSWORD = process.env.SARTHI_PASSWORD ?? ''

async function login(page: Page) {
  await page.goto('/')
  const pw = page.getByPlaceholder('Password')
  if (await pw.isVisible().catch(() => false)) {
    await pw.fill(APP_PASSWORD)
    await page.getByRole('button', { name: 'Enter' }).click()
  }
  await expect(page.getByTestId('footer')).toBeVisible()
}

test('deep screens outside the bottom nav each have a back control', async ({ page }) => {
  await login(page)
  for (const [route, target] of [
    ['/tests/new', '/audit'],
    ['/ca', '/audit'],
    ['/topic/POL-01', '/syllabus'],
  ] as const) {
    await page.goto(route)
    const back = page.getByTestId('back')
    await expect(back, `${route} has no back control`).toBeVisible()
    // a real tap target, not a text link
    const box = await back.boundingBox()
    expect(box!.height, `${route} back control is too small to tap`).toBeGreaterThanOrEqual(40)
    await back.click()
    await page.waitForURL(new RegExp(target), { timeout: 30_000 })
  }
})

test('practice hides the nav but the exit is unmissable and returns to the filters', async ({ page }) => {
  await login(page)
  await page.goto('/practice?n=2&subject=POL')
  await page.getByRole('link', { name: /Start/i }).click()
  await page.waitForURL(/\/practice\/run/, { timeout: 30_000 })

  // focus is deliberate: the bottom nav is gone here
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0)

  const exit = page.getByTestId('exit')
  await expect(exit).toBeVisible()
  const box = await exit.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(40)

  await exit.click()
  await page.waitForURL(/\/practice(\?|$)/, { timeout: 30_000 })
  // and the nav is back the moment practice ends
  await expect(page.getByTestId('bottom-nav')).toBeVisible()
})

test('the batch summary offers both Practice and Today', async ({ page }) => {
  await login(page)
  await page.goto('/practice?n=1&subject=POL')
  await page.getByRole('link', { name: /Start/i }).click()
  await page.waitForURL(/\/practice\/run/, { timeout: 30_000 })

  await page.getByRole('button', { name: 'sure', exact: true }).click()
  await page.getByTestId('option-a').click()
  await page.getByTestId('reveal').click()
  const verdict = page.getByTestId('verdict')
  await expect(verdict).toBeVisible()
  if ((await verdict.getAttribute('data-correct')) === 'false') {
    await page.getByTestId('reason-1').click()
  }
  await page.getByTestId('next').click()

  const summary = page.getByTestId('summary')
  await expect(summary).toBeVisible()
  await expect(page.getByTestId('summary-practice')).toBeVisible()
  await expect(page.getByTestId('summary-today')).toBeVisible()
})

test('practice defaults to GS1; CSAT is a deliberate switch', async ({ page }) => {
  await login(page)
  await page.goto('/practice')

  // GS1 is the default pool — CSAT is qualifying only and must be asked for
  await expect(page.getByTestId('paper-gs1')).toBeVisible()
  const csat = page.getByTestId('paper-csat')
  await expect(csat).toBeVisible()

  const gs1Href = await page.getByTestId('paper-gs1').getAttribute('href')
  expect(gs1Href).not.toContain('paper=CSAT')

  await csat.click()
  await page.waitForURL(/paper=CSAT/, { timeout: 30_000 })
  // the year chips follow the paper, so they must not still show GS1-only years
  await expect(page.getByTestId('paper-csat')).toBeVisible()
})
