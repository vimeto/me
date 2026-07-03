import { test, expect } from './helpers'

const SLUG = 'attention-variants-beyond-softmax'

test.describe('post page', () => {
  test('header, tag chips, and reading-progress bar grow with scroll', async ({ page }) => {
    await page.goto(`/blog/${SLUG}`)
    const h1 = page.locator('h1.font-serif')
    await expect(h1).toBeVisible()

    // Family tag chips in the header (Language models, ML systems).
    await expect(page.getByText('Language models', { exact: true }).first()).toBeVisible()

    const bar = page.locator('div.bg-ink.fixed')
    await expect(bar).toBeAttached()
    const scaleAt = () =>
      bar.evaluate((el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
        return m.a // horizontal scale
      })
    const top = await scaleAt()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect.poll(scaleAt).toBeGreaterThan(top + 0.3)
  })

  test('ParamPlot is interactive — moving a slider changes the path', async ({ page }) => {
    await page.goto(`/blog/${SLUG}`)
    const figure = page.locator('figure').first()
    await expect(figure).toBeVisible()
    const path = figure.locator('svg path[stroke]').first()
    await expect(path).toBeAttached()
    const before = await path.getAttribute('d')

    const thumb = page.getByRole('slider').first()
    await thumb.focus()
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight')

    await expect.poll(() => path.getAttribute('d')).not.toBe(before)
  })

  test('Quiz renders and an option is clickable', async ({ page }) => {
    await page.goto(`/blog/${SLUG}`)
    const quiz = page.locator('section', { hasText: 'Quiz' }).first()
    await expect(quiz).toBeVisible()
    const option = quiz.getByRole('button').first()
    await option.click()
    await expect(option).toHaveAttribute('aria-pressed', 'true')
  })

  test('back link returns to the writing index', async ({ page }) => {
    await page.goto(`/blog/${SLUG}`)
    await page.getByRole('link', { name: /All writing/ }).click()
    await expect(page).toHaveURL(/\/blog$/)
  })
})
