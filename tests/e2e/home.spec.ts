import { test, expect, revealAll, scrollToSection } from './helpers'

test.describe('home page', () => {
  test('all sections render', async ({ page }) => {
    await page.goto('/')
    for (const id of [
      'hero',
      'research',
      'projects',
      'background',
      'future',
      'writing',
      'contact',
    ]) {
      await expect(page.locator(`#${id}`)).toBeAttached()
    }
  })

  test('projects ledger shows flagship figures and no deleted sections', async ({ page }) => {
    await page.goto('/')
    await scrollToSection(page, 'projects')
    for (const figure of ['Acquired', 'ICDCS 2026', '1st / 125']) {
      await expect(page.getByText(figure, { exact: false }).first()).toBeVisible()
    }
    await expect(page.getByText('Talks', { exact: false })).toHaveCount(0)
    await expect(page.getByText('Media Kit', { exact: false })).toHaveCount(0)
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/')
    await revealAll(page)
    const overflow = await page.evaluate(
      () => document.scrollingElement!.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('section numeral reaches its final value', async ({ page }) => {
    await page.goto('/')
    await scrollToSection(page, 'projects')
    // The projects SectionHeader numeral counts up to "02".
    const numeral = page.locator('#projects').locator('h2 span.font-mono').first()
    await expect(numeral).toHaveText('02')
  })
})
