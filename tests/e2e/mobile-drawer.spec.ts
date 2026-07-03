import { test, expect } from './helpers'

test.describe('mobile drawer', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile viewport only')

  test('opens, has large hit targets, navigates, and closes', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Open navigation' })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const drawer = page.getByRole('dialog', { name: 'Site navigation' })
    await expect(drawer).toBeVisible()

    // Every drawer item is a comfortable touch target (>= 44px tall).
    const items = drawer.getByRole('button')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const box = await items.nth(i).boundingBox()
      expect(box, `drawer item ${i} has a box`).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    // Tapping "Projects" closes the drawer and scrolls the section into view.
    await drawer.getByRole('button', { name: 'Projects', exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect
      .poll(() =>
        page.locator('#projects').evaluate((el) => {
          const top = el.getBoundingClientRect().top
          return top < window.innerHeight && top > -window.innerHeight
        })
      )
      .toBe(true)
  })

  test('Escape closes the drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const drawer = page.getByRole('dialog', { name: 'Site navigation' })
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
  })
})
