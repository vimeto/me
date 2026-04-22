/**
 * Pure-ish filesystem operations used by the MCP tools. Separated from the
 * MCP wiring so tests can exercise them with a temp directory instead of the
 * real repo.
 *
 * `repoRoot` is the absolute path to the project root (contains
 * `content/posts/` and `content/drafts/`). Every function takes it as an
 * argument — no module-level state — so tests can create isolated fixtures.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import matter from 'gray-matter'

const exec = promisify(execFile)

export type PostSummary = {
  slug: string
  title: string
  status: 'draft' | 'published'
  publishedAt: string
  updatedAt?: string
  summary: string
  tags: string[]
  category?: string
  sourcePath: string
}

const SLUG_RE = /^[a-z0-9-]+$/

function postsDir(repoRoot: string) {
  return path.join(repoRoot, 'content', 'posts')
}
function draftsDir(repoRoot: string) {
  return path.join(repoRoot, 'content', 'drafts')
}

async function readFrontmatter(file: string): Promise<matter.GrayMatterFile<string>> {
  const raw = await fs.readFile(file, 'utf8')
  return matter(raw)
}

async function walkPostFiles(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    const files: string[] = []
    for (const e of entries) {
      const abs = path.join(root, e.name)
      if (e.isDirectory()) {
        const indexPath = path.join(abs, 'index.mdx')
        try {
          await fs.access(indexPath)
          files.push(indexPath)
        } catch {
          // Directory without index.mdx — skip silently.
        }
      } else if (e.isFile() && e.name.endsWith('.mdx')) {
        files.push(abs)
      }
    }
    return files
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

function toSummary(parsed: matter.GrayMatterFile<string>, sourcePath: string): PostSummary {
  const fm = parsed.data as Record<string, unknown>
  return {
    slug: String(fm.slug ?? ''),
    title: String(fm.title ?? ''),
    status: (fm.status === 'published' ? 'published' : 'draft') as PostSummary['status'],
    publishedAt: String(fm.publishedAt ?? ''),
    updatedAt: fm.updatedAt ? String(fm.updatedAt) : undefined,
    summary: String(fm.summary ?? ''),
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    category: fm.category ? String(fm.category) : undefined,
    sourcePath,
  }
}

export async function listPosts(
  repoRoot: string,
  opts: { includeDrafts?: boolean } = {}
): Promise<PostSummary[]> {
  const files = [
    ...(await walkPostFiles(postsDir(repoRoot))),
    ...(opts.includeDrafts !== false ? await walkPostFiles(draftsDir(repoRoot)) : []),
  ]
  const summaries: PostSummary[] = []
  for (const f of files) {
    const parsed = await readFrontmatter(f)
    summaries.push(toSummary(parsed, path.relative(repoRoot, f)))
  }
  return summaries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export async function readPost(
  repoRoot: string,
  slug: string
): Promise<{ summary: PostSummary; content: string }> {
  if (!SLUG_RE.test(slug)) throw new Error(`invalid slug: ${slug}`)
  // Prefer published post, fall back to draft.
  const candidates = [
    path.join(postsDir(repoRoot), slug, 'index.mdx'),
    path.join(draftsDir(repoRoot), `${slug}.mdx`),
  ]
  for (const c of candidates) {
    try {
      const parsed = await readFrontmatter(c)
      return {
        summary: toSummary(parsed, path.relative(repoRoot, c)),
        content: parsed.content,
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
  throw new Error(`post not found: ${slug}`)
}

export type DraftInput = {
  slug: string
  title: string
  summary: string
  publishedAt: string
  tags?: string[]
  category?: string
  estimatedReadMin?: number
  body: string
}

export async function createDraft(
  repoRoot: string,
  input: DraftInput
): Promise<{ path: string; created: boolean }> {
  if (!SLUG_RE.test(input.slug)) throw new Error(`invalid slug: ${input.slug}`)
  const drafts = draftsDir(repoRoot)
  await fs.mkdir(drafts, { recursive: true })
  const filePath = path.join(drafts, `${input.slug}.mdx`)

  try {
    await fs.access(filePath)
    throw new Error(`draft already exists: content/drafts/${input.slug}.mdx`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  // Also refuse if a published post with the same slug already exists — we
  // don't want two sources of truth for the same permalink.
  try {
    await fs.access(path.join(postsDir(repoRoot), input.slug, 'index.mdx'))
    throw new Error(`published post with slug "${input.slug}" already exists`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  const frontmatter: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    publishedAt: input.publishedAt,
    summary: input.summary,
    tags: input.tags ?? [],
    status: 'draft',
  }
  if (input.category) frontmatter.category = input.category
  if (input.estimatedReadMin) frontmatter.estimatedReadMin = input.estimatedReadMin

  const content = serializeMdx(frontmatter, input.body)
  await fs.writeFile(filePath, content, 'utf8')
  return { path: path.relative(repoRoot, filePath), created: true }
}

function serializeMdx(frontmatter: Record<string, unknown>, body: string): string {
  const fmString = matter.stringify('', frontmatter).trimEnd() + '\n'
  const trimmedBody = body.endsWith('\n') ? body : body + '\n'
  return `${fmString}\n${trimmedBody}`
}

export async function publishDraft(
  repoRoot: string,
  slug: string
): Promise<{ from: string; to: string }> {
  if (!SLUG_RE.test(slug)) throw new Error(`invalid slug: ${slug}`)
  const draftPath = path.join(draftsDir(repoRoot), `${slug}.mdx`)
  let parsed: matter.GrayMatterFile<string>
  try {
    parsed = await readFrontmatter(draftPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`no draft at content/drafts/${slug}.mdx`)
    }
    throw err
  }

  const targetDir = path.join(postsDir(repoRoot), slug)
  const targetPath = path.join(targetDir, 'index.mdx')
  try {
    await fs.access(targetPath)
    throw new Error(`published post already exists: content/posts/${slug}/index.mdx`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  await fs.mkdir(targetDir, { recursive: true })
  const fm = { ...parsed.data, status: 'published' } as Record<string, unknown>
  const content = serializeMdx(fm, parsed.content.trimStart())
  await fs.writeFile(targetPath, content, 'utf8')
  await fs.rm(draftPath)
  return {
    from: path.relative(repoRoot, draftPath),
    to: path.relative(repoRoot, targetPath),
  }
}

export async function validatePost(
  repoRoot: string,
  slug?: string
): Promise<{ ok: boolean; output: string }> {
  // Delegate to the existing static validator. We run it via `tsx` so the
  // MCP server doesn't need its own validator copy.
  const args = ['tsx', 'scripts/validate-posts.ts']
  if (slug) {
    const candidates = [
      path.join('content', 'posts', slug, 'index.mdx'),
      path.join('content', 'drafts', `${slug}.mdx`),
    ]
    for (const c of candidates) {
      try {
        await fs.access(path.join(repoRoot, c))
        args.push(c)
        break
      } catch {
        // try next
      }
    }
  }
  try {
    const { stdout, stderr } = await exec('pnpm', ['exec', ...args], {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true, output: stdout + stderr }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, output: (e.stdout ?? '') + (e.stderr ?? '') + (e.message ?? '') }
  }
}

export async function readRegistryCatalog(repoRoot: string): Promise<string> {
  const file = path.join(repoRoot, 'registry-catalog.json')
  try {
    return await fs.readFile(file, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        'registry-catalog.json not found — run `pnpm docs:registry` to regenerate it.'
      )
    }
    throw err
  }
}
