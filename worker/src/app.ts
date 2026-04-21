import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, RequestDeps } from './types'
import { commentsRouter } from './routes/comments'
import { adminRouter } from './routes/admin'
import { accessMiddleware } from './middleware/access'
import { makeModeration, type ModerationClient } from './lib/moderation'
import { makeTurnstile, type TurnstileClient } from './lib/turnstile'

// Dependencies that the comment-submission pipeline needs. Exposed as an
// optional argument so tests can inject deterministic stubs. When omitted,
// the app lazy-builds real clients from `env` on the first request that
// needs them.
export interface AppDeps {
  moderation?: ModerationClient | null
  turnstile?: TurnstileClient | null
  now?: () => string
}

export function createApp(overrides: AppDeps = {}) {
  const app = new Hono<{ Bindings: Env; Variables: { deps: RequestDeps } }>()

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

  // Wire deps onto the request context. Route handlers read them via
  // `c.var.deps`. The factory form means a test can short-circuit the real
  // Anthropic/Turnstile clients without touching process state.
  app.use('*', async (c, next) => {
    const deps: RequestDeps = {
      moderation:
        overrides.moderation !== undefined
          ? overrides.moderation
          : makeModeration(c.env.HAIKU_API_KEY),
      turnstile:
        overrides.turnstile !== undefined
          ? overrides.turnstile
          : makeTurnstile(c.env.TURNSTILE_SECRET),
      now: overrides.now ?? (() => new Date().toISOString()),
    }
    c.set('deps', deps)
    await next()
  })

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

  return app
}
