// Blog-publisher MCP core tests. Runs under plain `tsx`. Each test creates
// a temp repo root, exercises a tool handler, and asserts on filesystem
// state. No MCP protocol plumbing — tests target the pure file ops in
// `core.ts` (the protocol wiring is a thin adapter we don't unit-test).

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createDraft, listPosts, publishDraft, readPost, readRegistryCatalog } from '../src/core.js'

type Case = { name: string; run: (root: string) => Promise<void> }
const cases: Case[] = []
function test(name: string, run: (root: string) => Promise<void>) {
  cases.push({ name, run })
}
function assertEq<T>(actual: T, expected: T, msg: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`)
}

async function mkTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'blog-publisher-test-'))
}

async function seedPost(root: string, slug: string, fm: Record<string, unknown>, body: string) {
  const dir = path.join(root, 'content', 'posts', slug)
  await fs.mkdir(dir, { recursive: true })
  const fmLines = Object.entries(fm).map(([k, v]) =>
    typeof v === 'string' ? `${k}: '${v}'` : `${k}: ${JSON.stringify(v)}`
  )
  await fs.writeFile(
    path.join(dir, 'index.mdx'),
    `---\n${fmLines.join('\n')}\n---\n\n${body}\n`,
    'utf8'
  )
}

test('listPosts returns seeded posts newest-first', async (root) => {
  await seedPost(
    root,
    'older',
    {
      title: 'Older',
      slug: 'older',
      publishedAt: '2026-01-01',
      summary: 'x',
      tags: ['a'],
      status: 'published',
    },
    '# body'
  )
  await seedPost(
    root,
    'newer',
    {
      title: 'Newer',
      slug: 'newer',
      publishedAt: '2026-03-01',
      summary: 'y',
      tags: [],
      status: 'published',
    },
    '# body'
  )
  const posts = await listPosts(root)
  assertEq(posts.length, 2, 'count')
  assertEq(posts[0].slug, 'newer', 'newest first')
  assertEq(posts[1].slug, 'older', 'oldest last')
})

test('listPosts respects includeDrafts=false', async (root) => {
  await fs.mkdir(path.join(root, 'content', 'drafts'), { recursive: true })
  await fs.writeFile(
    path.join(root, 'content', 'drafts', 'wip.mdx'),
    `---\ntitle: 'WIP'\nslug: wip\npublishedAt: '2026-04-01'\nsummary: 'x'\nstatus: 'draft'\n---\n\n# wip\n`,
    'utf8'
  )
  const all = await listPosts(root)
  const onlyPublished = await listPosts(root, { includeDrafts: false })
  assertEq(all.length, 1, 'draft counted')
  assertEq(onlyPublished.length, 0, 'draft excluded')
})

test('readPost prefers published over draft', async (root) => {
  await seedPost(
    root,
    'dual',
    {
      title: 'Dual',
      slug: 'dual',
      publishedAt: '2026-04-01',
      summary: 's',
      status: 'published',
    },
    '# published body'
  )
  await fs.mkdir(path.join(root, 'content', 'drafts'), { recursive: true })
  await fs.writeFile(
    path.join(root, 'content', 'drafts', 'dual.mdx'),
    `---\ntitle: 'Dual draft'\nslug: dual\npublishedAt: '2026-04-02'\nsummary: 'x'\nstatus: 'draft'\n---\n\n# draft body\n`,
    'utf8'
  )
  const { summary, content } = await readPost(root, 'dual')
  assertEq(summary.status, 'published', 'status prefers published')
  if (!content.includes('published body')) throw new Error('wrong body: ' + content)
})

test('createDraft writes a new file with correct frontmatter', async (root) => {
  const res = await createDraft(root, {
    slug: 'new-draft',
    title: 'A new draft',
    summary: 'About new drafts.',
    publishedAt: '2026-04-22',
    tags: ['foo'],
    body: '# hello world\n\nBody.',
  })
  assertEq(res.path, 'content/drafts/new-draft.mdx', 'draft path')
  const raw = await fs.readFile(path.join(root, 'content', 'drafts', 'new-draft.mdx'), 'utf8')
  if (!raw.includes("title: 'A new draft'") && !raw.includes('title: A new draft')) {
    throw new Error('title missing from frontmatter: ' + raw)
  }
  if (!raw.includes('status: draft')) throw new Error('status missing: ' + raw)
  if (!raw.includes('# hello world')) throw new Error('body missing: ' + raw)
})

test('createDraft refuses to overwrite an existing draft', async (root) => {
  await createDraft(root, {
    slug: 'dup',
    title: 'T',
    summary: 'S',
    publishedAt: '2026-04-22',
    body: 'b',
  })
  let threw = false
  try {
    await createDraft(root, {
      slug: 'dup',
      title: 'T2',
      summary: 'S2',
      publishedAt: '2026-04-22',
      body: 'b2',
    })
  } catch (err) {
    threw = true
    if (!String(err).includes('already exists')) {
      throw new Error(`wrong error: ${err}`)
    }
  }
  if (!threw) throw new Error('should have thrown')
})

test('createDraft rejects collision with published post', async (root) => {
  await seedPost(
    root,
    'taken',
    {
      title: 'Taken',
      slug: 'taken',
      publishedAt: '2026-04-01',
      summary: 's',
      status: 'published',
    },
    'x'
  )
  let threw = false
  try {
    await createDraft(root, {
      slug: 'taken',
      title: 'T',
      summary: 'S',
      publishedAt: '2026-04-22',
      body: 'b',
    })
  } catch (err) {
    threw = true
    if (!String(err).includes('already exists')) throw err
  }
  if (!threw) throw new Error('collision should throw')
})

test('publishDraft moves the file and flips status', async (root) => {
  await createDraft(root, {
    slug: 'promote-me',
    title: 'Promote',
    summary: 'Summary',
    publishedAt: '2026-04-22',
    body: '# body',
  })
  const res = await publishDraft(root, 'promote-me')
  assertEq(res.from, 'content/drafts/promote-me.mdx', 'from path')
  assertEq(res.to, 'content/posts/promote-me/index.mdx', 'to path')

  // Draft should be gone.
  let stillThere = true
  try {
    await fs.access(path.join(root, 'content', 'drafts', 'promote-me.mdx'))
  } catch {
    stillThere = false
  }
  if (stillThere) throw new Error('draft not deleted')

  const final = await fs.readFile(
    path.join(root, 'content', 'posts', 'promote-me', 'index.mdx'),
    'utf8'
  )
  if (!final.includes('status: published')) {
    throw new Error('status not flipped: ' + final)
  }
})

test('publishDraft fails when draft does not exist', async (root) => {
  let threw = false
  try {
    await publishDraft(root, 'nope')
  } catch (err) {
    threw = true
    if (!String(err).includes('no draft')) throw err
  }
  if (!threw) throw new Error('should throw on missing draft')
})

test('readRegistryCatalog surfaces an explicit error when file is missing', async (root) => {
  let threw = false
  try {
    await readRegistryCatalog(root)
  } catch (err) {
    threw = true
    if (!String(err).includes('registry-catalog.json')) throw err
  }
  if (!threw) throw new Error('should throw when catalog missing')
})

async function main() {
  let failed = 0
  for (const t of cases) {
    const root = await mkTempRoot()
    try {
      await t.run(root)
      console.log(`✓ ${t.name}`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`✗ ${t.name}\n  ${msg}`)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  }
  const total = cases.length
  if (failed > 0) {
    console.error(`\n${failed}/${total} blog-publisher tests failed.`)
    process.exit(1)
  }
  console.log(`\nAll ${total} blog-publisher tests passed.`)
}

main()
