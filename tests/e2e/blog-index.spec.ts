import { test, expect } from './helpers'

test.describe('blog index', () => {
  test('featured slot shows LATEST and links to the newest post', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByText('LATEST', { exact: true })).toBeVisible()
    const featured = page.locator('article').first()
    const link = featured.locator('h2 a')
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/blog\//)
  })

  test('year group headers render', async ({ page }) => {
    await page.goto('/blog')
    const years = page.locator('div.font-mono.tabular-nums', { hasText: /^\d{4}$/ })
    await expect(years.first()).toBeVisible()
  })

  test('zero-padded entry numbers exist', async ({ page }) => {
    await page.goto('/blog')
    const numbers = page.locator('span.font-mono.tabular-nums').filter({ hasText: /^0\d{2}$/ })
    await expect(numbers.first()).toBeVisible()
  })

  test('every entry has a 320x200 thumbnail', async ({ page }) => {
    await page.goto('/blog')
    const thumbs = page.locator('svg[viewBox="0 0 320 200"]')
    const articles = page.locator('article')
    const entryCount = await articles.count()
    expect(entryCount).toBeGreaterThan(0)
    await expect.poll(() => thumbs.count()).toBeGreaterThanOrEqual(entryCount)
  })

  test('affordance strips and read time render', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByText('interactive plot', { exact: false }).first()).toBeVisible()
    const contains = page.getByText('contains:', { exact: false })
    await expect(contains.first()).toBeVisible()
    await expect(page.getByText(/·\s*\d+\s*min/).first()).toBeVisible()
  })

  test('filtering by Language models narrows and hides the featured slot', async ({ page }) => {
    await page.goto('/blog')
    const rowsAll = await page.locator('article').count()
    await expect(page.getByText('LATEST', { exact: true })).toBeVisible()

    await page
      .getByRole('button', { name: /^Language models/ })
      .first()
      .click()
    // Featured slot disappears when a specific family is selected.
    await expect(page.getByText('LATEST', { exact: true })).toHaveCount(0)
    const rowsFiltered = await page.locator('article').count()
    expect(rowsFiltered).toBeLessThanOrEqual(rowsAll)
    expect(rowsFiltered).toBeGreaterThan(0)

    // Every visible row carries the Language models family chip.
    const articles = page.locator('article')
    for (let i = 0; i < rowsFiltered; i++) {
      await expect(articles.nth(i).getByText('Language models', { exact: true })).toBeVisible()
    }

    // "All" brings the featured slot back.
    await page.getByRole('button', { name: /^All/ }).click()
    await expect(page.getByText('LATEST', { exact: true })).toBeVisible()
  })

  test('clicking a row title navigates to the post', async ({ page }) => {
    await page.goto('/blog')
    // Pick a non-featured row title (inside a year group).
    const rowLink = page.locator('article a[href^="/blog/"]').nth(1)
    const href = await rowLink.getAttribute('href')
    await rowLink.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.locator('h1.font-serif')).toBeVisible()
  })

  test('mobile: no horizontal overflow and dates fit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile viewport only')
    await page.goto('/blog')
    const overflow = await page.evaluate(
      () => document.scrollingElement!.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
    // No element bleeds past the right viewport edge.
    const worstOverflow = await page.evaluate(() => {
      let worst = 0
      for (const el of Array.from(document.querySelectorAll('article *'))) {
        const r = el.getBoundingClientRect()
        worst = Math.max(worst, r.right - window.innerWidth)
      }
      return worst
    })
    expect(worstOverflow).toBeLessThanOrEqual(1)
  })
})
