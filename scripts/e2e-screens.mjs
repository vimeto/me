import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT =
  '/private/tmp/claude-501/-Users-vilhelmtoivonen-code-omat-personal-page/05c5f716-ec08-409d-974f-8da28a22d0a1/scratchpad/screens'
const BASE = 'http://localhost:5199'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function shot({ name, path, width, height, dark }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  })
  if (dark) {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('darkMode', 'true')
      } catch {
        /* ignore */
      }
    })
  }
  const page = await context.newPage()
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  // Reveal whileInView content by scrolling through, then return to top.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8
    const max = document.scrollingElement.scrollHeight
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: true })
  console.log(`wrote ${name}`)
  await context.close()
}

await shot({ name: 'home-desktop-light.png', path: '/', width: 1280, height: 720, dark: false })
await shot({ name: 'home-desktop-dark.png', path: '/', width: 1280, height: 720, dark: true })
await shot({ name: 'home-mobile-light.png', path: '/', width: 390, height: 844, dark: false })
await shot({ name: 'blog-desktop-light.png', path: '/blog', width: 1280, height: 720, dark: false })
await shot({ name: 'blog-desktop-dark.png', path: '/blog', width: 1280, height: 720, dark: true })
await shot({ name: 'blog-mobile-light.png', path: '/blog', width: 390, height: 844, dark: false })
await shot({
  name: 'post-desktop-light.png',
  path: '/blog/attention-variants-beyond-softmax',
  width: 1280,
  height: 720,
  dark: false,
})

await browser.close()
console.log('done')
