#!/usr/bin/env tsx
// Smoke test: after a production build, verify RSS + JSON feeds are shaped
// correctly and that HTML advertises both via <link rel="alternate">.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dist = path.join(root, 'dist')

type Check = { name: string; run: () => void }
const checks: Check[] = []
function check(name: string, run: () => void) {
  checks.push({ name, run })
}

check('feed.xml exists and has dc:creator, CDATA summaries, enclosures', () => {
  const xml = fs.readFileSync(path.join(dist, 'feed.xml'), 'utf8')
  if (!xml.includes('xmlns:dc=')) throw new Error('dc: namespace missing')
  if (!/<dc:creator>/.test(xml)) throw new Error('dc:creator missing on items')
  if (!/<description><!\[CDATA\[/.test(xml)) throw new Error('CDATA-wrapped description missing')
  if (!/<enclosure url="[^"]+\/og\/[a-z0-9-]+\.png"/.test(xml)) {
    throw new Error('per-post enclosure missing')
  }
  if (!/<image>[\s\S]*?<\/image>/.test(xml)) throw new Error('channel <image> missing')
})

check('feed.json is valid JSON Feed 1.1 with items', () => {
  const json = JSON.parse(fs.readFileSync(path.join(dist, 'feed.json'), 'utf8'))
  if (json.version !== 'https://jsonfeed.org/version/1.1') {
    throw new Error(`unexpected version: ${json.version}`)
  }
  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new Error('no items')
  }
  for (const item of json.items) {
    for (const key of ['id', 'url', 'title', 'date_published']) {
      if (!item[key]) throw new Error(`item ${item.id ?? '?'} missing ${key}`)
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(item.date_published)) {
      throw new Error(`non-ISO date_published: ${item.date_published}`)
    }
  }
})

check('HTML advertises both RSS and JSON Feed alternates', () => {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  if (!/rel="alternate"[^>]*type="application\/rss\+xml"[^>]*href="\/feed\.xml"/.test(html)) {
    throw new Error('RSS <link rel="alternate"> missing')
  }
  if (!/rel="alternate"[^>]*type="application\/feed\+json"[^>]*href="\/feed\.json"/.test(html)) {
    throw new Error('JSON Feed <link rel="alternate"> missing')
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
  console.error(`\n${failed}/${checks.length} feed smoke checks failed.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} feed smoke checks passed.`)
