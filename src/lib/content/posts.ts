import type { ComponentType } from 'react'
import type { MDXProps } from 'mdx/types'
import { PostFrontmatter, type Post } from '@/schemas/post'

type MDXModule = {
  default: ComponentType<MDXProps>
  frontmatter: Record<string, unknown>
}

const modules = import.meta.glob<MDXModule>('/content/posts/**/index.mdx', {
  eager: true,
})

function toPost(sourcePath: string, m: MDXModule): Post {
  const parsed = PostFrontmatter.safeParse(m.frontmatter)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid frontmatter in ${sourcePath}:\n${issues}`)
  }
  const meta = parsed.data
  return {
    ...meta,
    Body: m.default,
    sourcePath,
    permalink: `/blog/${meta.slug}`,
  }
}

const allPosts: Post[] = Object.entries(modules).map(([path, m]) => toPost(path, m))

const bySlug = new Map(allPosts.map((p) => [p.slug, p]))

function byDateDesc(a: Post, b: Post): number {
  if (a.publishedAt === b.publishedAt) return 0
  return a.publishedAt < b.publishedAt ? 1 : -1
}

export function listPosts(opts: { includeDrafts?: boolean } = {}): Post[] {
  return allPosts
    .filter((p) => opts.includeDrafts || p.status === 'published')
    .sort(byDateDesc)
}

export function getPost(slug: string): Post | undefined {
  return bySlug.get(slug)
}
