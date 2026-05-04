import { Hono } from 'hono'
import { z } from 'zod'
import type { CommentRow, Env, PublicComment, RequestDeps } from '../types'
import { hashIp } from '../lib/ip'
import { toSafeHtml } from '../lib/sanitize'

const SLUG_RE = /^[a-z0-9-]{1,120}$/

// Rate limit: no more than N submissions in the last WINDOW ms per IP hash.
const RATE_LIMIT_COUNT = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

type CommentsEnv = { Bindings: Env; Variables: { deps: RequestDeps } }

const SubmissionSchema = z.object({
  slug: z.string().regex(SLUG_RE, 'slug'),
  author: z.string().trim().min(1, 'author').max(80, 'author'),
  // Email is optional; blank string collapses to undefined. Not shown
  // publicly — only used for the moderator to reach out if needed.
  email: z
    .union([z.string().email().max(200), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  body: z.string().trim().min(1, 'body').max(4000, 'body'),
  turnstileToken: z.string().optional(),
  // Spam honeypot: a hidden field no human fills in. Any non-empty value
  // means the submitter is almost certainly a bot — we silently drop it.
  honeypot: z.string().optional(),
})

export const commentsRouter = new Hono<CommentsEnv>()

commentsRouter.get('/', async (c) => {
  const slug = c.req.query('post') ?? ''
  if (!SLUG_RE.test(slug)) {
    return c.json({ error: 'invalid or missing post slug' }, 400)
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, author_name, body_html, created_at
       FROM comments
      WHERE post_slug = ?
        AND status = 'approved'
      ORDER BY created_at ASC
      LIMIT 500`
  )
    .bind(slug)
    .all<Pick<CommentRow, 'id' | 'author_name' | 'body_html' | 'created_at'>>()

  const payload: PublicComment[] = (results ?? []).map((r) => ({
    id: r.id,
    author: r.author_name,
    bodyHtml: r.body_html,
    createdAt: r.created_at,
  }))

  return c.json({ post: slug, count: payload.length, comments: payload })
})

commentsRouter.post('/', async (c) => {
  const deps = c.get('deps')

  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'invalid json' }, 400)
  }

  const parsed = SubmissionSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: 'validation', issues: parsed.error.issues.map((i) => i.message) }, 400)
  }
  const input = parsed.data

  // Honeypot: respond "accepted" so bots don't learn we caught them.
  if (input.honeypot && input.honeypot.length > 0) {
    console.info('comment: honeypot tripped')
    return c.json({ status: 'pending' })
  }

  // Turnstile. We don't hard-block on failure (ad-blockers, browser quirks
  // like Trusted-Types CSP inside the challenge iframe, transient widget
  // 600010s) — instead, a missing or invalid token forces the comment into
  // the human moderation queue. Honest spam still has to clear the LLM
  // moderator and the per-IP rate limit below.
  let turnstilePassed = true
  if (deps.turnstile) {
    const ip = c.req.header('CF-Connecting-IP') ?? undefined
    turnstilePassed = await deps.turnstile.verify(input.turnstileToken ?? '', ip)
  }

  const ip = c.req.header('CF-Connecting-IP') ?? '0.0.0.0'
  const ua = c.req.header('User-Agent') ?? null
  const salt = c.env.IP_HASH_SALT ?? 'dev-salt'
  const ipHash = await hashIp(ip, salt)

  // Rate limit: bail out before touching the LLM so spammers can't burn quota.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { results: recent } = await c.env.DB.prepare(
    `SELECT submitted_at FROM submission_log
      WHERE client_ip_hash = ? AND submitted_at > ?`
  )
    .bind(ipHash, windowStart)
    .all<{ submitted_at: string }>()
  if ((recent?.length ?? 0) >= RATE_LIMIT_COUNT) {
    return c.json({ error: 'rate limit' }, 429)
  }

  // Moderation. When no client is configured (no OPENAI_API_KEY) we default
  // to pending so a human sees every comment before it goes live. A failed
  // Turnstile also forces pending — the LLM may still vote `reject` on
  // outright spam, but auto-approval requires both signals to clear.
  let status: CommentRow['status'] = 'pending'
  let reason: string | null = turnstilePassed ? null : 'turnstile failed; routing to manual review'
  if (deps.moderation) {
    const verdict = await deps.moderation.check({
      slug: input.slug,
      author: input.author,
      body: input.body,
    })
    if (verdict.verdict === 'approve' && turnstilePassed) {
      status = 'approved'
      reason = `auto-approved: ${verdict.reason}`.slice(0, 500)
    } else if (verdict.verdict === 'reject') {
      status = 'rejected'
      reason = `auto-rejected: ${verdict.reason}`.slice(0, 500)
    } else if (verdict.verdict === 'approve' && !turnstilePassed) {
      reason = `pending (turnstile failed; LLM said approve): ${verdict.reason}`.slice(0, 500)
    } else {
      reason = `queued for review: ${verdict.reason}`.slice(0, 500)
    }
  }

  const bodyHtml = toSafeHtml(input.body)
  const now = deps.now()

  const inserted = await c.env.DB.prepare(
    `INSERT INTO comments
       (post_slug, author_name, author_email, body, body_html, status,
        created_at, moderation_reason, client_ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(
      input.slug,
      input.author,
      input.email,
      input.body,
      bodyHtml,
      status,
      now,
      reason,
      ipHash,
      ua
    )
    .first<{ id: number }>()

  await c.env.DB.prepare(`INSERT INTO submission_log (client_ip_hash, submitted_at) VALUES (?, ?)`)
    .bind(ipHash, now)
    .run()

  // Rejected comments get the same public response shape as pending ones —
  // we don't want spammers to learn the verdict from the response.
  const publicStatus: 'pending' | 'approved' = status === 'approved' ? 'approved' : 'pending'
  return c.json({ status: publicStatus, id: inserted?.id ?? null })
})
