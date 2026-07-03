import { test, expect, scrollToSection } from './helpers'

test.describe('navigation', () => {
  test('VT monogram returns to top (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop nav only')
    await page.goto('/')
    const brand = page.getByRole('button', { name: 'Back to top' })
    await expect(brand).toBeVisible()
    await scrollToSection(page, 'contact')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
    await brand.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(100)
  })

  test('active section underline follows scroll (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop nav only')
    await page.goto('/')
    const underline = page.locator('nav >> css=span.bg-ink')
    // Hero is active at the top: exactly one underline exists.
    await expect(underline).toHaveCount(1)
    const projectsLink = page.getByRole('button', { name: 'Projects', exact: true })
    await scrollToSection(page, 'projects')
    // The underline (framer layoutId) migrates under the Projects link.
    await expect
      .poll(async () => {
        const linkBox = await projectsLink.boundingBox()
        const ulBox = await underline.boundingBox()
        if (!linkBox || !ulBox) return false
        return Math.abs(ulBox.x - linkBox.x) < 6 && ulBox.y > linkBox.y
      })
      .toBe(true)
  })

  test('dark mode toggles, persists, and paints pre-hydration', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: 'Switch to dark mode' })
    await toggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(await page.evaluate(() => localStorage.getItem('darkMode'))).toBe('true')

    // Reload: the inline <head> script must apply `dark` before first paint.
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true
    )
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe('rgb(0, 0, 0)')
  })

  test('filter chips do not shift layout on hover/activate', async ({ page }) => {
    await page.goto('/blog')
    // First inactive family chip (the "All" chip starts active).
    const chip = page.getByRole('button', { name: /^Language models/ }).first()
    await expect(chip).toBeVisible()
    const before = await chip.boundingBox()
    await chip.hover()
    const hovered = await chip.boundingBox()
    await chip.click()
    const active = await chip.boundingBox()
    expect(before).not.toBeNull()
    const near = (a: number, b: number) => Math.abs(a - b) < 0.5
    expect(near(before!.width, hovered!.width) && near(before!.height, hovered!.height)).toBe(true)
    expect(near(before!.width, active!.width) && near(before!.height, active!.height)).toBe(true)
    expect(near(before!.x, active!.x) && near(before!.y, active!.y)).toBe(true)
  })
})
