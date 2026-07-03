import { z } from 'zod'
import type { ComponentType } from 'react'
import type { MDXProps } from 'mdx/types'
import { isValidTag } from '../lib/tags'

export const PostFrontmatter = z
  .object({
    title: z.string().min(1).max(140),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, and hyphens'),
    publishedAt: z.iso.date(),
    updatedAt: z.iso.date().optional(),
    summary: z.string().min(1).max(320),
    tags: z
      .array(
        z.string().refine(isValidTag, {
          message:
            'tag must be a valid path from src/lib/tags.ts tagTree (e.g. "language-models/inference/quantization")',
        })
      )
      .default([]),
    category: z.string().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    estimatedReadMin: z.number().positive().optional(),
    cover: z.string().optional(),
    // BCP-47 primary language subtag. A post directory holds one canonical
    // `index.mdx` plus optional `index.<lang>.mdx` variants that share its
    // slug — the variants are the same post in another language, not
    // separate posts.
    lang: z
      .string()
      .regex(/^[a-z]{2}$/, 'lang must be a two-letter language code (e.g. "en", "fi")')
      .default('en'),
  })
  .strict()

export type PostMeta = z.infer<typeof PostFrontmatter>

export type Post = PostMeta & {
  Body: ComponentType<MDXProps>
  sourcePath: string
  permalink: string
  /** Languages this post exists in, canonical first. Length 1 for most posts. */
  languages: string[]
  /** Language variants of this post (canonical post lists its variants; a variant lists none). */
  variants: Post[]
}
