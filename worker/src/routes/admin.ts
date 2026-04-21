import { Hono } from 'hono'
import type { AccessUser, CommentRow, Env } from '../types'

type AdminEnv = { Bindings: Env; Variables: { user: AccessUser } }

const STATUS_VALUES = ['pending', 'approved', 'rejected'] as const
type Status = (typeof STATUS_VALUES)[number]
function isStatus(v: string): v is Status {
  return (STATUS_VALUES as readonly string[]).includes(v)
}

function parseId(raw: string): number | null {
  // Defend against `NaN`, floats, negatives, scientific notation. D1 ids are
  // plain positive integers.
  if (!/^\d{1,18}$/.test(raw)) return null
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export const adminRouter = new Hono<AdminEnv>()

// GET /api/admin/comments?status=pending
// Lists comments of a given status (default: pending) for the moderation queue.
adminRouter.get('/comments', async (c) => {
  const statusParam = c.req.query('status') ?? 'pending'
  if (!isStatus(statusParam)) {
    return c.json({ error: 'invalid status' }, 400)
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, post_slug, author_name, author_email, body, body_html, status,
            created_at, moderated_at, moderation_reason
       FROM comments
      WHERE status = ?
      ORDER BY created_at ASC
      LIMIT 500`
  )
    .bind(statusParam)
    .all<CommentRow>()

  return c.json({ status: statusParam, count: results?.length ?? 0, comments: results ?? [] })
})

// POST /api/admin/comments/:id/approve
adminRouter.post('/comments/:id/approve', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === null) return c.json({ error: 'invalid id' }, 400)

  const user = c.get('user')
  const now = new Date().toISOString()
  const res = await c.env.DB.prepare(
    `UPDATE comments
        SET status = 'approved',
            moderated_at = ?,
            moderation_reason = ?
      WHERE id = ?`
  )
    .bind(now, `approved by ${user.email}`, id)
    .run()

  if (!res.meta || res.meta.changes === 0) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true, id, status: 'approved', moderatedAt: now })
})

// POST /api/admin/comments/:id/reject  body: { reason?: string }
adminRouter.post('/comments/:id/reject', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === null) return c.json({ error: 'invalid id' }, 400)

  let reason = ''
  try {
    const body = (await c.req.json()) as { reason?: unknown }
    if (typeof body?.reason === 'string') reason = body.reason.slice(0, 500)
  } catch {
    // Body is optional — empty reason is fine.
  }

  const user = c.get('user')
  const now = new Date().toISOString()
  const finalReason = reason ? `${reason} (by ${user.email})` : `rejected by ${user.email}`
  const res = await c.env.DB.prepare(
    `UPDATE comments
        SET status = 'rejected',
            moderated_at = ?,
            moderation_reason = ?
      WHERE id = ?`
  )
    .bind(now, finalReason, id)
    .run()

  if (!res.meta || res.meta.changes === 0) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true, id, status: 'rejected', moderatedAt: now, reason: finalReason })
})

// DELETE /api/admin/comments/:id
// Hard delete so GDPR takedowns leave no trace. Audit log lives in worker tail.
adminRouter.delete('/comments/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === null) return c.json({ error: 'invalid id' }, 400)

  const user = c.get('user')
  console.info(`admin delete: id=${id} by=${user.email}`)
  const res = await c.env.DB.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run()

  if (!res.meta || res.meta.changes === 0) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true, id, deleted: true })
})
