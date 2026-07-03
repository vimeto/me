import { test as base, expect, type Page } from '@playwright/test'

/**
 * Dev-only noise we tolerate: the comments worker and Turnstile aren't running
 * in `pnpm dev`, and favicons occasionally 404 on a cold cache. Everything else
 * — hydration mismatches, React warnings, uncaught exceptions — should fail.
 */
const ALLOWED = /api\/comments|challenges\.cloudflare|turnstile|favicon/i

type Errors = { messages: string[] }

/**
 * `test` with an auto-fixture that records `console.error` and uncaught page
 * errors across the whole test, then asserts none slipped through the allowlist
 * once the body finishes.
 */
export const test = base.extend<{ errors: Errors }>({
  errors: [
    async ({ page }, use) => {
      const store: Errors = { messages: [] }
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          // Resource-load failures ("… 404 …") carry the URL in location(),
          // not the message text — fold both into the allowlist check.
          const url = msg.location()?.url ?? ''
          const text = `${msg.text()} ${url}`.trim()
          if (!ALLOWED.test(text)) store.messages.push(`console.error: ${text}`)
        }
      })
      page.on('pageerror', (err) => {
        const text = err.message
        if (!ALLOWED.test(text)) store.messages.push(`pageerror: ${text}`)
      })
      await use(store)
      expect(
        store.messages,
        `unexpected console/page errors:\n${store.messages.join('\n')}`
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Slowly scroll from top to bottom so every `whileInView` block reveals. */
export async function revealAll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8
    const max = document.scrollingElement!.scrollHeight
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
  })
}

/** Scroll a section into view and settle. */
export async function scrollToSection(page: Page, id: string): Promise<void> {
  await page.evaluate((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ block: 'center' })
  }, id)
}
