// Worker smoke tests — runs under plain `tsx`, no Miniflare required.
//
// Strategy: `app.fetch(req, env)` hits the Hono router directly. We wire a
// tiny in-memory D1 stub into `env.DB` and assert behaviour at the HTTP
// boundary, exactly as a client would.

import app from '../src/index'
import { createStubD1, mkComment } from './stub-d1'
import type { Env } from '../src/types'

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
