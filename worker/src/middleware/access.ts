import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { MiddlewareHandler } from 'hono'
import type { AccessUser, Env } from '../types'

// Cloudflare Access puts the signed JWT in this header on every request that
// reaches an origin behind an Access application. The worker treats a valid
// JWT as proof that a human operator signed in with one of the identity
// providers configured in the Access dashboard (Google SSO in our case).
const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion'

// In local `wrangler dev`, Cloudflare's proxy is not in front of us. The dev
// loop instead injects this header. We only trust it when ACCESS_DEV_BYPASS=1.
const DEV_EMAIL_HEADER = 'cf-access-authenticated-user-email'

export type AccessVerifier = (token: string, env: Env) => Promise<AccessUser>

// Cache JWKS loaders per team domain. `createRemoteJWKSet` handles its own
// response caching, but instantiating it allocates; we avoid doing that on
// every request.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(teamDomain: string) {
  const cached = jwksCache.get(teamDomain)
  if (cached) return cached
  const url = new URL(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`)
  const jwks = createRemoteJWKSet(url)
  jwksCache.set(teamDomain, jwks)
  return jwks
}

export const verifyCfAccessJwt: AccessVerifier = async (token, env) => {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new Error('ACCESS_TEAM_DOMAIN and ACCESS_AUD must be set')
  }
  const jwks = getJwks(env.ACCESS_TEAM_DOMAIN)
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${env.ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`,
    audience: env.ACCESS_AUD,
  })
  const email = typeof payload.email === 'string' ? payload.email : undefined
  if (!email) throw new Error('access token missing email claim')
  return { email, sub: typeof payload.sub === 'string' ? payload.sub : undefined }
}

export function accessMiddleware(
  verify: AccessVerifier = verifyCfAccessJwt
): MiddlewareHandler<{ Bindings: Env; Variables: { user: AccessUser } }> {
  return async (c, next) => {
    // Dev-only bypass. `wrangler dev` forwards the logged-in email in a
    // plaintext header; trust it only when the env explicitly opts in.
    if (c.env.ACCESS_DEV_BYPASS === '1') {
      const email = c.req.header(DEV_EMAIL_HEADER)
      if (!email) return c.json({ error: 'unauthenticated' }, 401)
      c.set('user', { email })
      await next()
      return
    }

    const token = c.req.header(ACCESS_JWT_HEADER)
    if (!token) return c.json({ error: 'unauthenticated' }, 401)

    try {
      const user = await verify(token, c.env)
      c.set('user', user)
    } catch (err) {
      console.warn('access jwt rejected:', err instanceof Error ? err.message : err)
      return c.json({ error: 'unauthenticated' }, 401)
    }

    await next()
  }
}
