/**
 * Visual-regression suite — renders every Ladle story and snapshots the
 * story-body iframe. Ladle routes to `/?story=<id>&mode=preview` which renders
 * just the story without the navigation chrome.
 */
import { test, expect } from '@playwright/test'

const stories: Array<{ id: string; name: string }> = [
  { id: 'blocks-figure--basic', name: 'figure-basic' },
  { id: 'blocks-figure--no-caption', name: 'figure-no-caption' },
  { id: 'blocks-callout--info', name: 'callout-info' },
  { id: 'blocks-callout--warn', name: 'callout-warn' },
  { id: 'blocks-callout--insight', name: 'callout-insight' },
  { id: 'blocks-callout--aside', name: 'callout-aside' },
  { id: 'blocks-quiz--single-select', name: 'quiz-single-select' },
  { id: 'blocks-quiz--multi-select', name: 'quiz-multi-select' },
  { id: 'blocks-quiz--without-explanation', name: 'quiz-without-explanation' },
  { id: 'blocks-loopedsvg--pulse', name: 'loopedsvg-pulse' },
  { id: 'blocks-loopedsvg--wave', name: 'loopedsvg-wave' },
  { id: 'blocks-loopedsvg--orbit', name: 'loopedsvg-orbit' },
  { id: 'blocks-loopedsvg--scan', name: 'loopedsvg-scan' },
  { id: 'blocks-loopedsvg--initially-paused', name: 'loopedsvg-initially-paused' },
  { id: 'blocks-paramplot--gptq-flipping-range', name: 'paramplot-gptq' },
  { id: 'blocks-paramplot--serving-latency-tail', name: 'paramplot-latency' },
  { id: 'blocks-paramplot--unknown-compute-key', name: 'paramplot-unknown' },
]

for (const s of stories) {
  test(`story ${s.name}`, async ({ page }) => {
    await page.goto(`/?story=${s.id}&mode=preview`)
    // Wait for custom fonts so the snapshot isn't taken mid-FOUT.
    await page.evaluate(() => document.fonts.ready)
    // Give framer-motion time to settle — animations are disabled by expect
    // config but the initial mount still needs a frame.
    await page.waitForTimeout(200)
    await expect(page).toHaveScreenshot(`${s.name}.png`, {
      fullPage: true,
    })
  })
}
