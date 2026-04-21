// Worker smoke tests — runs under plain `tsx`, no Miniflare required.
//
// Strategy: `app.fetch(req, env)` hits the Hono router directly. We wire a
// tiny in-memory D1 stub into `env.DB` and assert behaviour at the HTTP
// boundary, exactly as a client would.

import app from '../src/index'
import { createApp } from '../src/app'
import { createStubD1, mkComment } from './stub-d1'
import type { Env } from '../src/types'
import type { ModerationClient, ModerationVerdict } from '../src/lib/moderation'
import type { TurnstileClient } from '../src/lib/turnstile'

type Case = { name: string; run: () => Promise<void> }

const cases: Case[] = []
function test(name: string, run: () => Promise<void>) {
  cases.push({ name, run })
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`)
}

function mkEnv(d1: ReturnType<typeof createStubD1>): Env {
  return {
    DB: d1 as unknown as Env['DB'],
    SITE_ORIGIN: 'https://vilhelmtoivonen.com',
    ADMIN_ORIGIN: 'https://vilhelmtoivonen.com',
  }
}

// Admin tests use the dev-bypass path: `ACCESS_DEV_BYPASS=1` trusts the
// `cf-access-authenticated-user-email` header. This matches what happens
// under `wrangler dev`. Production JWT verification is exercised separately
// by a test that sets bypass off and sends no token → 401.
function mkAdminEnv(d1: ReturnType<typeof createStubD1>, bypass = true): Env {
  return {
    ...mkEnv(d1),
    ACCESS_TEAM_DOMAIN: 'example-team',
    ACCESS_AUD: 'fake-aud',
    ACCESS_DEV_BYPASS: bypass ? '1' : undefined,
  }
}

const ADMIN_EMAIL = 'vilhelm@example.com'
function adminReq(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers)
  headers.set('cf-access-authenticated-user-email', ADMIN_EMAIL)
  return new Request(`http://worker.test${path}`, { ...init, headers })
}

test('GET /api/health returns 200', async () => {
  const res = await app.fetch(new Request('http://worker.test/api/health'), mkEnv(createStubD1()))
  assertEq(res.status, 200, 'health status')
  const body = (await res.json()) as { ok: boolean; service: string }
  assertEq(body.ok, true, 'health body.ok')
  assertEq(body.service, 'personal-page-worker', 'health body.service')
})

test('GET /api/comments with valid slug returns approved only, ordered', async () => {
  const db = createStubD1([
    mkComment({
      id: 1,
      post_slug: 'two-tails',
      author_name: 'Ada',
      body: 'hi',
      body_html: '<p>hi</p>',
      status: 'approved',
      created_at: '2026-04-01T10:00:00.000Z',
    }),
    mkComment({
      id: 2,
      post_slug: 'two-tails',
      author_name: 'Pending',
      body: 'pending',
      body_html: '<p>pending</p>',
      status: 'pending',
      created_at: '2026-04-02T10:00:00.000Z',
    }),
    mkComment({
      id: 3,
      post_slug: 'two-tails',
      author_name: 'Bob',
      body: 'later',
      body_html: '<p>later</p>',
      status: 'approved',
      created_at: '2026-04-03T10:00:00.000Z',
    }),
    mkComment({
      id: 4,
      post_slug: 'other-post',
      author_name: 'Other',
      body: 'elsewhere',
      body_html: '<p>elsewhere</p>',
      status: 'approved',
      created_at: '2026-04-02T10:00:00.000Z',
    }),
  ])
  const res = await app.fetch(
    new Request('http://worker.test/api/comments?post=two-tails'),
    mkEnv(db)
  )
  assertEq(res.status, 200, 'comments status')
  const body = (await res.json()) as {
    post: string
    count: number
    comments: { id: number; author: string }[]
  }
  assertEq(body.post, 'two-tails', 'post slug echoed')
  assertEq(body.count, 2, 'only approved counted')
  assertEq(
    body.comments.map((c) => c.id),
    [1, 3],
    'approved comments returned, rejected/pending excluded'
  )
  assertEq(
    body.comments.map((c) => c.author),
    ['Ada', 'Bob'],
    'authors match'
  )
})

test('GET /api/comments for slug with no rows returns empty list', async () => {
  const db = createStubD1()
  const res = await app.fetch(
    new Request('http://worker.test/api/comments?post=never-posted'),
    mkEnv(db)
  )
  assertEq(res.status, 200, 'empty status')
  const body = (await res.json()) as { count: number; comments: unknown[] }
  assertEq(body.count, 0, 'zero count')
  assertEq(body.comments.length, 0, 'zero comments')
})

test('GET /api/comments rejects missing post slug', async () => {
  const db = createStubD1()
  const res = await app.fetch(new Request('http://worker.test/api/comments'), mkEnv(db))
  assertEq(res.status, 400, 'missing slug status')
})

test('GET /api/comments rejects malformed slug', async () => {
  const db = createStubD1()
  const res = await app.fetch(
    new Request('http://worker.test/api/comments?post=Bad%20Slug!'),
    mkEnv(db)
  )
  assertEq(res.status, 400, 'bad slug status')
})

test('Unknown route returns JSON 404', async () => {
  const res = await app.fetch(
    new Request('http://worker.test/api/does-not-exist'),
    mkEnv(createStubD1())
  )
  assertEq(res.status, 404, '404 status')
})

// ---------------------------------------------------------------------------
// Admin routes (Cloudflare Access-gated).
// ---------------------------------------------------------------------------

test('admin GET without auth header (dev bypass on) returns 401', async () => {
  const res = await app.fetch(
    new Request('http://worker.test/api/admin/comments'),
    mkAdminEnv(createStubD1())
  )
  assertEq(res.status, 401, 'missing email → 401')
})

test('admin GET without auth header (bypass off, no JWT) returns 401', async () => {
  const res = await app.fetch(
    new Request('http://worker.test/api/admin/comments'),
    mkAdminEnv(createStubD1(), false)
  )
  assertEq(res.status, 401, 'missing JWT → 401')
})

test('admin GET /comments defaults to pending and filters by status', async () => {
  const db = createStubD1([
    mkComment({
      id: 10,
      post_slug: 'two-tails',
      author_name: 'Spam',
      body: 'pending',
      body_html: '<p>pending</p>',
      status: 'pending',
      created_at: '2026-04-10T10:00:00.000Z',
    }),
    mkComment({
      id: 11,
      post_slug: 'two-tails',
      author_name: 'Ada',
      body: 'ok',
      body_html: '<p>ok</p>',
      status: 'approved',
      created_at: '2026-04-11T10:00:00.000Z',
    }),
    mkComment({
      id: 12,
      post_slug: 'two-tails',
      author_name: 'Bob',
      body: 'new',
      body_html: '<p>new</p>',
      status: 'pending',
      created_at: '2026-04-12T10:00:00.000Z',
    }),
  ])
  const res = await app.fetch(adminReq('/api/admin/comments'), mkAdminEnv(db))
  assertEq(res.status, 200, 'list status')
  const body = (await res.json()) as {
    status: string
    count: number
    comments: { id: number; status: string }[]
  }
  assertEq(body.status, 'pending', 'default status filter')
  assertEq(body.count, 2, 'only pending counted')
  assertEq(
    body.comments.map((c) => c.id),
    [10, 12],
    'pending ids in order'
  )

  const approvedRes = await app.fetch(
    adminReq('/api/admin/comments?status=approved'),
    mkAdminEnv(db)
  )
  const approved = (await approvedRes.json()) as { count: number }
  assertEq(approved.count, 1, 'approved count via query')
})

test('admin approve flips pending → approved and stamps moderator email', async () => {
  const db = createStubD1([
    mkComment({
      id: 42,
      post_slug: 'two-tails',
      author_name: 'New',
      body: 'please approve',
      body_html: '<p>please approve</p>',
      status: 'pending',
    }),
  ])
  const res = await app.fetch(
    adminReq('/api/admin/comments/42/approve', { method: 'POST' }),
    mkAdminEnv(db)
  )
  assertEq(res.status, 200, 'approve status')
  const body = (await res.json()) as { ok: boolean; id: number; status: string }
  assertEq(body.ok, true, 'approve ok')
  assertEq(body.id, 42, 'approve id')
  assertEq(body.status, 'approved', 'approve status field')

  const [row] = db._all()
  assertEq(row.status, 'approved', 'row status mutated')
  if (!row.moderation_reason?.includes(ADMIN_EMAIL)) {
    throw new Error(`reason should include moderator email, got: ${row.moderation_reason}`)
  }
  if (!row.moderated_at) throw new Error('moderated_at should be set')
})

test('admin reject stores reason and stamps moderator email', async () => {
  const db = createStubD1([
    mkComment({
      id: 7,
      post_slug: 'two-tails',
      author_name: 'Spam',
      body: 'buy crypto',
      body_html: '<p>buy crypto</p>',
      status: 'pending',
    }),
  ])
  const res = await app.fetch(
    adminReq('/api/admin/comments/7/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    }),
    mkAdminEnv(db)
  )
  assertEq(res.status, 200, 'reject status')
  const body = (await res.json()) as { status: string; reason: string }
  assertEq(body.status, 'rejected', 'reject status field')
  if (!body.reason.startsWith('spam') || !body.reason.includes(ADMIN_EMAIL)) {
    throw new Error(`reason should combine user reason + moderator, got: ${body.reason}`)
  }

  const [row] = db._all()
  assertEq(row.status, 'rejected', 'row status mutated')
})

test('admin delete removes row and returns 404 on repeat', async () => {
  const db = createStubD1([
    mkComment({
      id: 99,
      post_slug: 'two-tails',
      author_name: 'Gone',
      body: 'bye',
      body_html: '<p>bye</p>',
      status: 'approved',
    }),
  ])
  const first = await app.fetch(
    adminReq('/api/admin/comments/99', { method: 'DELETE' }),
    mkAdminEnv(db)
  )
  assertEq(first.status, 200, 'delete status')
  assertEq(db._all().length, 0, 'row removed')

  const second = await app.fetch(
    adminReq('/api/admin/comments/99', { method: 'DELETE' }),
    mkAdminEnv(db)
  )
  assertEq(second.status, 404, 'double delete → 404')
})

test('admin rejects malformed id and status parameters', async () => {
  const db = createStubD1()
  const bad = await app.fetch(
    adminReq('/api/admin/comments/not-a-number/approve', { method: 'POST' }),
    mkAdminEnv(db)
  )
  assertEq(bad.status, 400, 'bad id → 400')

  const badStatus = await app.fetch(adminReq('/api/admin/comments?status=banana'), mkAdminEnv(db))
  assertEq(badStatus.status, 400, 'bad status → 400')
})

// ---------------------------------------------------------------------------
// Public POST /api/comments — the submission pipeline.
// ---------------------------------------------------------------------------

function stubModeration(verdict: ModerationVerdict, reason = 'stub'): ModerationClient {
  return { check: async () => ({ verdict, reason }) }
}

function stubTurnstile(ok: boolean): TurnstileClient {
  return { verify: async () => ok }
}

function postComment(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://worker.test/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const FIXED_NOW = '2026-04-21T09:00:00.000Z'

test('POST /api/comments approves clean submission when moderator says approve', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: stubModeration('approve', 'benign'),
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const res = await testApp.fetch(
    postComment({
      slug: 'two-tails',
      author: 'Ada',
      body: 'Nice post!\n\nThanks.',
      turnstileToken: 'x',
    }),
    mkEnv(db)
  )
  assertEq(res.status, 200, 'approved submission status')
  const body = (await res.json()) as { status: string; id: number }
  assertEq(body.status, 'approved', 'public status')
  const row = db._all()[0]
  assertEq(row.status, 'approved', 'db status')
  assertEq(row.post_slug, 'two-tails', 'db slug')
  assertEq(row.author_name, 'Ada', 'db author')
  assertEq(row.body_html, '<p>Nice post!</p>\n<p>Thanks.</p>', 'sanitised html')
  assertEq(db._submissions().length, 1, 'rate-limit log written')
})

test('POST rejects spam silently — public status is "pending"', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: stubModeration('reject', 'obvious spam'),
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const res = await testApp.fetch(
    postComment({ slug: 'two-tails', author: 'Spam', body: 'Buy crypto!' }),
    mkEnv(db)
  )
  assertEq(res.status, 200, 'silent-reject status')
  const body = (await res.json()) as { status: string }
  // Public status must not reveal the rejection — prevents oracle attacks.
  assertEq(body.status, 'pending', 'public status for rejected is pending')
  const row = db._all()[0]
  assertEq(row.status, 'rejected', 'db row marked rejected')
  if (!row.moderation_reason?.startsWith('auto-rejected:')) {
    throw new Error(`expected auto-rejected reason, got: ${row.moderation_reason}`)
  }
})

test('POST defaults to pending when no moderator is configured', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: null,
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const res = await testApp.fetch(
    postComment({ slug: 'two-tails', author: 'Ada', body: 'hi' }),
    mkEnv(db)
  )
  assertEq(res.status, 200, 'no-moderator status')
  const body = (await res.json()) as { status: string }
  assertEq(body.status, 'pending', 'no-moderator is pending')
  assertEq(db._all()[0].status, 'pending', 'db pending')
})

test('POST honeypot silently drops and never writes to DB', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: stubModeration('approve'),
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const res = await testApp.fetch(
    postComment({
      slug: 'two-tails',
      author: 'Bot',
      body: 'hi',
      honeypot: 'http://spam.example',
    }),
    mkEnv(db)
  )
  assertEq(res.status, 200, 'honeypot appears to succeed')
  const body = (await res.json()) as { status: string }
  assertEq(body.status, 'pending', 'honeypot looks pending')
  assertEq(db._all().length, 0, 'no row written')
  assertEq(db._submissions().length, 0, 'no submission log')
})

test('POST returns 403 when Turnstile rejects the token', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: stubModeration('approve'),
    turnstile: stubTurnstile(false),
    now: () => FIXED_NOW,
  })
  const res = await testApp.fetch(
    postComment({ slug: 'two-tails', author: 'Ada', body: 'hi', turnstileToken: 'bad' }),
    mkEnv(db)
  )
  assertEq(res.status, 403, 'turnstile reject')
  assertEq(db._all().length, 0, 'no row written on turnstile fail')
})

test('POST 429s once rate limit threshold is reached', async () => {
  const db = createStubD1()
  // Seed 5 recent submissions for a known IP hash so we hit the limit
  // without having to POST five times — keeps the test focused on the
  // rate-limit branch. IP hash must match what the worker computes for
  // `CF-Connecting-IP: 10.0.0.1` with salt `test-salt`.
  const { createHash } = await import('node:crypto')
  const ipHash = createHash('sha256').update('test-salt:10.0.0.1').digest('hex')
  const now = Date.now()
  db._seedSubmissions(
    Array.from({ length: 5 }, (_, i) => ({
      client_ip_hash: ipHash,
      submitted_at: new Date(now - i * 1000).toISOString(),
    }))
  )
  const testApp = createApp({
    moderation: stubModeration('approve'),
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const env: Env = { ...mkEnv(db), IP_HASH_SALT: 'test-salt' }
  const res = await testApp.fetch(
    postComment(
      { slug: 'two-tails', author: 'Ada', body: 'hi' },
      { 'CF-Connecting-IP': '10.0.0.1' }
    ),
    env
  )
  assertEq(res.status, 429, 'rate limited')
})

test('POST validates input — missing body and oversize body both 400', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: null,
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const missing = await testApp.fetch(postComment({ slug: 'two-tails', author: 'Ada' }), mkEnv(db))
  assertEq(missing.status, 400, 'missing body → 400')

  const oversize = await testApp.fetch(
    postComment({
      slug: 'two-tails',
      author: 'Ada',
      body: 'x'.repeat(5000),
    }),
    mkEnv(db)
  )
  assertEq(oversize.status, 400, 'oversize body → 400')

  const badSlug = await testApp.fetch(
    postComment({ slug: 'BAD SLUG', author: 'Ada', body: 'hi' }),
    mkEnv(db)
  )
  assertEq(badSlug.status, 400, 'bad slug → 400')
})

test('POST rejects malformed JSON', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: null,
    turnstile: null,
    now: () => FIXED_NOW,
  })
  const res = await testApp.fetch(
    new Request('http://worker.test/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    }),
    mkEnv(db)
  )
  assertEq(res.status, 400, 'bad json → 400')
})

test('POST then GET returns the approved comment', async () => {
  const db = createStubD1()
  const testApp = createApp({
    moderation: stubModeration('approve'),
    turnstile: null,
    now: () => FIXED_NOW,
  })
  await testApp.fetch(
    postComment({ slug: 'two-tails', author: 'Ada', body: 'round-trip test' }),
    mkEnv(db)
  )
  const getRes = await testApp.fetch(
    new Request('http://worker.test/api/comments?post=two-tails'),
    mkEnv(db)
  )
  const body = (await getRes.json()) as { count: number; comments: { bodyHtml: string }[] }
  assertEq(body.count, 1, 'round-trip count')
  assertEq(body.comments[0].bodyHtml, '<p>round-trip test</p>', 'round-trip html')
})

async function main() {
  let failed = 0
  for (const t of cases) {
    try {
      await t.run()
      console.log(`✓ ${t.name}`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`✗ ${t.name}\n  ${msg}`)
    }
  }
  const total = cases.length
  if (failed > 0) {
    console.error(`\n${failed}/${total} worker tests failed.`)
    process.exit(1)
  }
  console.log(`\nAll ${total} worker tests passed.`)
}

main()
