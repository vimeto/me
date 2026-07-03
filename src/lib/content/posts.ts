import type { ComponentType } from 'react'
import type { MDXProps } from 'mdx/types'
import { PostFrontmatter, type Post, type PostMeta } from '@/schemas/post'

type MDXModule = {
  default: ComponentType<MDXProps>
  frontmatter: Record<string, unknown>
}

// A post directory holds one canonical `index.mdx` and optional
// `index.<lang>.mdx` language variants. Variants are the same post in another
// language: they share the canonical's slug (enforced below), get a
// `/blog/<slug>/<lang>` permalink, and never appear as separate index entries.
const canonicalModules = import.meta.glob<MDXModule>('/content/posts/**/index.mdx', {
  eager: true,
})
const variantModules = import.meta.glob<MDXModule>('/content/posts/**/index.*.mdx', {
  eager: true,
})

function parseMeta(sourcePath: string, m: MDXModule): PostMeta {
  const parsed = PostFrontmatter.safeParse(m.frontmatter)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid frontmatter in ${sourcePath}:\n${issues}`)
  }
  return parsed.data
}

function dirOf(sourcePath: string): string {
  return sourcePath.slice(0, sourcePath.lastIndexOf('/'))
}

function buildPosts(): Post[] {
  const out: Post[] = []
  for (const [path, m] of Object.entries(canonicalModules)) {
    const meta = parseMeta(path, m)
    const canonical: Post = {
      ...meta,
      Body: m.default,
      sourcePath: path,
      permalink: `/blog/${meta.slug}`,
      languages: [meta.lang],
      variants: [],
    }

    const dir = dirOf(path)
    for (const [vPath, vm] of Object.entries(variantModules)) {
      if (dirOf(vPath) !== dir) continue
      const vMeta = parseMeta(vPath, vm)
      if (vMeta.slug !== meta.slug) {
        throw new Error(
          `Language variant ${vPath} has slug "${vMeta.slug}" but its canonical post is "${meta.slug}". Variants must share the canonical slug.`
        )
      }
      if (vMeta.lang === meta.lang) {
        throw new Error(
          `Language variant ${vPath} declares lang "${vMeta.lang}", same as the canonical index.mdx. Give the variant its own lang.`
        )
      }
      canonical.variants.push({
        ...vMeta,
        Body: vm.default,
        sourcePath: vPath,
        permalink: `/blog/${vMeta.slug}/${vMeta.lang}`,
        languages: [meta.lang],
        variants: [],
      })
    }

    canonical.variants.sort((a, b) => a.lang.localeCompare(b.lang))
    canonical.languages = [meta.lang, ...canonical.variants.map((v) => v.lang)]
    // Every variant shares the full language list so the switcher renders the
    // same options regardless of which language you are reading.
    for (const v of canonical.variants) v.languages = canonical.languages
    out.push(canonical)
  }
  return out
}

const allPosts: Post[] = buildPosts()

const bySlug = new Map(allPosts.map((p) => [p.slug, p]))

function byDateDesc(a: Post, b: Post): number {
  if (a.publishedAt === b.publishedAt) return 0
  return a.publishedAt < b.publishedAt ? 1 : -1
}

export function listPosts(opts: { includeDrafts?: boolean } = {}): Post[] {
  return allPosts.filter((p) => opts.includeDrafts || p.status === 'published').sort(byDateDesc)
}

export function getPost(slug: string, lang?: string): Post | undefined {
  const canonical = bySlug.get(slug)
  if (!canonical) return undefined
  if (!lang || lang === canonical.lang) return canonical
  return canonical.variants.find((v) => v.lang === lang)
}
