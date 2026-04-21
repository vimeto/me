import { Hono } from 'hono'
import type { Env, CommentRow, PublicComment } from '../types'

const SLUG_RE = /^[a-z0-9-]{1,120}$/

export const commentsRouter = new Hono<{ Bindings: Env }>()

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
