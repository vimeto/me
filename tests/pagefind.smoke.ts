#!/usr/bin/env tsx
// Smoke test: after a production build, verify Pagefind indexed the blog.
// Assumes `pnpm build` has already been run. Doesn't rebuild — that's the
// caller's responsibility so this stays fast enough to run in a tight loop.

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

check('dist/search/index.html was prerendered', () => {
  const file = path.join(dist, 'search', 'index.html')
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
  const html = fs.readFileSync(file, 'utf8')
  if (!html.includes('SEARCH')) throw new Error('search page markup missing')
  // robots noindex for the search page — it's a utility, not content.
  if (!/name="robots"\s+content="noindex/i.test(html)) {
    throw new Error('search page missing noindex robots meta')
  }
})

check('dist/pagefind/pagefind.js exists', () => {
  const file = path.join(dist, 'pagefind', 'pagefind.js')
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
})

check('dist/pagefind/pagefind-entry.json references at least one fragment', () => {
  const file = path.join(dist, 'pagefind', 'pagefind-entry.json')
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
  const fragDir = path.join(dist, 'pagefind', 'fragment')
  if (!fs.existsSync(fragDir)) throw new Error('fragment/ directory missing')
  const frags = fs.readdirSync(fragDir)
  if (frags.length === 0) throw new Error('no fragments — Pagefind indexed nothing')
})

check('blog post HTML opts into Pagefind via data-pagefind-body', () => {
  const postsDir = path.join(dist, 'blog')
  const entries = fs.readdirSync(postsDir, { withFileTypes: true })
  const postDirs = entries.filter((d) => d.isDirectory()).map((d) => d.name)
  if (postDirs.length === 0) throw new Error('no posts in dist/blog')
  for (const slug of postDirs) {
    const html = fs.readFileSync(path.join(postsDir, slug, 'index.html'), 'utf8')
    if (!html.includes('data-pagefind-body')) {
      throw new Error(`post ${slug} is missing data-pagefind-body`)
    }
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
  console.error(`\n${failed}/${checks.length} pagefind smoke checks failed.`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} pagefind smoke checks passed.`)
