import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { commentsRouter } from './routes/comments'
import { adminRouter } from './routes/admin'
import { accessMiddleware } from './middleware/access'

// The public API surface for vilhelmtoivonen.com. Lives on a Cloudflare Worker
// and is proxied in front of the static SSG site. Admin routes will be added
// in Phase 5b, gated behind Cloudflare Access.
const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = [c.env?.SITE_ORIGIN, c.env?.ADMIN_ORIGIN].filter((x): x is string => !!x)
      if (allowed.length === 0) return origin ?? '*'
      return allowed.includes(origin) ? origin : allowed[0]
    },
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'CF-Access-Jwt-Assertion'],
    maxAge: 86400,
  })
)

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'personal-page-worker', time: new Date().toISOString() })
)

app.route('/api/comments', commentsRouter)

// Admin surface: gated by Cloudflare Access JWT. The middleware stashes the
// authenticated user on `c.var.user`; routes read that for audit entries.
app.use('/api/admin/*', accessMiddleware())
app.route('/api/admin', adminRouter)

app.notFound((c) => c.json({ error: 'not found' }, 404))

app.onError((err, c) => {
  // Never leak server-side details to the public; log to tail for debugging.
  console.error('worker error:', err)
  return c.json({ error: 'internal error' }, 500)
})

export default app
