#!/usr/bin/env tsx
// Smoke test: after a production build, verify OG PNG generation ran and the
// prerendered HTML points at the per-post PNG. Assumes `pnpm build` was run.

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

function readDistFile(relPath: string): string {
  return fs.readFileSync(path.join(dist, relPath), 'utf8')
}

check('dist/og/default.png exists and is a PNG', () => {
  const file = path.join(dist, 'og', 'default.png')
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
  const buf = fs.readFileSync(file)
  if (buf.length < 2048) throw new Error(`suspicious size: ${buf.length}`)
  // PNG magic: 89 50 4E 47
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error('not a PNG')
  }
})

check('every post has a matching /og/<slug>.png', () => {
  const postsDir = path.join(dist, 'blog')
  const entries = fs.readdirSync(postsDir, { withFileTypes: true })
  const slugs = entries.filter((d) => d.isDirectory()).map((d) => d.name)
  if (slugs.length === 0) throw new Error('no posts in dist/blog')
  for (const slug of slugs) {
    const pngPath = path.join(dist, 'og', `${slug}.png`)
    if (!fs.existsSync(pngPath)) {
      throw new Error(`missing ${pngPath}`)
    }
  }
})

check('post HTML references the per-slug PNG in og:image', () => {
  const postsDir = path.join(dist, 'blog')
  const slugs = fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  for (const slug of slugs) {
    const html = readDistFile(path.join('blog', slug, 'index.html'))
    const needle = `/og/${slug}.png`
    if (!html.includes(needle)) {
      throw new Error(`post ${slug} HTML missing ${needle}`)
    }
  }
})

check('landing page references the default PNG in og:image', () => {
  const html = readDistFile('index.html')
  if (!/og:image"\s+content="[^"]*\/og\/default\.png"/.test(html)) {
    throw new Error('landing page missing /og/default.png in og:image')
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
  console.error(`\n${failed}/${checks.length} og smoke checks failed.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} og smoke checks passed.`)
