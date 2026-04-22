#!/usr/bin/env tsx
// Unit-ish test for the Cloudflare Web Analytics beacon injection. The
// prerender pipeline itself isn't idempotent (it rewrites the file it reads),
// so we test the pure helper directly instead of round-tripping through disk.

import process from 'node:process'
// @ts-expect-error — mjs sibling with no .d.ts; the shape is documented in the file.
import { injectCloudflareBeacon } from '../scripts/lib/inject-analytics.mjs'

type Check = { name: string; run: () => void }
const checks: Check[] = []
function check(name: string, run: () => void) {
  checks.push({ name, run })
}

const TEMPLATE = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'

check('no token ⇒ html is returned unchanged', () => {
  const out = injectCloudflareBeacon(TEMPLATE, undefined)
  if (out !== TEMPLATE) throw new Error('html mutated when no token was provided')
})

check('empty token ⇒ html is returned unchanged', () => {
  const out = injectCloudflareBeacon(TEMPLATE, '')
  if (out !== TEMPLATE) throw new Error('html mutated when empty token was provided')
})

check('token ⇒ beacon script inserted before </head>', () => {
  const out = injectCloudflareBeacon(TEMPLATE, 'tok-xyz')
  if (!out.includes('static.cloudflareinsights.com/beacon.min.js')) {
    throw new Error('beacon src missing')
  }
  if (!out.includes('"token":"tok-xyz"')) throw new Error('token payload missing')
  // Beacon must be inside <head>, not elsewhere.
  const beaconIdx = out.indexOf('cloudflareinsights.com')
  const headEndIdx = out.indexOf('</head>')
  if (beaconIdx < 0 || headEndIdx < 0 || beaconIdx > headEndIdx) {
    throw new Error('beacon is not before </head>')
  }
})

check('tokens with weird characters round-trip as JSON-escaped', () => {
  const out = injectCloudflareBeacon(TEMPLATE, 'tok"quoted\\and\nnewline')
  // JSON.stringify handles the escaping.
  if (!out.includes('"token":"tok\\"quoted\\\\and\\nnewline"')) {
    throw new Error(`token not JSON-escaped: ${out}`)
  }
})

let failed = 0
for (const c of checks) {
  try {
    c.run()
    console.log(`✓ ${c.name}`)
  } catch (err) {
    failed++
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`✗ ${c.name}\n  ${msg}`)
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} analytics smoke checks failed.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} analytics smoke checks passed.`)
