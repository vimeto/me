import { z } from 'zod'
import type { ComponentType } from 'react'
import type { MDXProps } from 'mdx/types'

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
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    estimatedReadMin: z.number().positive().optional(),
    cover: z.string().optional(),
  })
  .strict()

export type PostMeta = z.infer<typeof PostFrontmatter>

export type Post = PostMeta & {
  Body: ComponentType<MDXProps>
  sourcePath: string
  permalink: string
}
