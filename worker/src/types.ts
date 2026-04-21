import type { D1Database } from '@cloudflare/workers-types'

export type Env = {
  DB: D1Database
  // Set by wrangler.toml / dashboard. See `.dev.vars.example`.
  ADMIN_ORIGIN?: string
  SITE_ORIGIN?: string
}

export type CommentRow = {
  id: number
  post_slug: string
  author_name: string
  author_email: string | null
  body: string
  body_html: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  moderated_at: string | null
  moderation_reason: string | null
}

export type PublicComment = {
  id: number
  author: string
  bodyHtml: string
  createdAt: string
}
