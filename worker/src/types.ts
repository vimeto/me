import type { D1Database } from '@cloudflare/workers-types'

export type Env = {
  DB: D1Database
  // Set by wrangler.toml / dashboard. See `.dev.vars.example`.
  ADMIN_ORIGIN?: string
  SITE_ORIGIN?: string
  // Cloudflare Access config used by the admin JWT middleware.
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  // Set to "1" in local dev only: bypasses JWT verification and trusts the
  // `cf-access-authenticated-user-email` header set by `wrangler dev`.
  ACCESS_DEV_BYPASS?: string
  // Comment submission pipeline (Phase 6).
  TURNSTILE_SECRET?: string
  OPENAI_API_KEY?: string
  IP_HASH_SALT?: string
}

export type AccessUser = {
  email: string
  sub?: string
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

export type SubmissionLogRow = {
  client_ip_hash: string
  submitted_at: string
}

// Shape of per-request dependencies set by the root middleware. Routes read
// these via `c.var.deps`. Kept here so every route file can import without
// creating an `app.ts` <-> `routes/*.ts` import cycle.
import type { ModerationClient } from './lib/moderation'
import type { TurnstileClient } from './lib/turnstile'

export type RequestDeps = {
  moderation: ModerationClient | null
  turnstile: TurnstileClient | null
  now: () => string
}
