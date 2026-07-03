import { test, expect } from './helpers'

test.describe('dark mode visuals', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('darkMode', 'true')
      } catch {
        /* ignore */
      }
    })
  })

  test('blog index renders on black with themed thumbnails and chips', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe('rgb(0, 0, 0)')

    // Thumbnails still draw their strokes in dark mode.
    const thumbs = page.locator('svg[viewBox="0 0 320 200"]')
    await expect.poll(() => thumbs.count()).toBeGreaterThan(0)

    // Family chip text uses the bright dark-mode variant: a real, set color
    // that is neither pure black nor pure white.
    const chip = page.locator('article').getByText('Language models', { exact: true }).first()
    await expect(chip).toBeVisible()
    const color = await chip.evaluate((el) => getComputedStyle(el).color)
    expect(color).toMatch(/^rgb/)
    expect(color).not.toBe('rgb(0, 0, 0)')
    expect(color).not.toBe('rgb(255, 255, 255)')
  })
})
