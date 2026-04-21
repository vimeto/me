/**
 * Tiny in-memory D1 stub. Implements enough of Cloudflare's D1 binding surface
 * for Hono route tests to run under plain `tsx` — no Miniflare / workerd
 * required. Schema-agnostic: tests seed rows directly into the `rows` array.
 */

import type { CommentRow } from '../src/types'

function matchQuery(sql: string, binds: unknown[], rows: CommentRow[]): CommentRow[] {
  // Only the shapes the current worker emits are recognised. Fail loud on
  // unknown SQL so the tests never silently return fake results.
  if (sql.includes('FROM comments') && sql.includes("status = 'approved'")) {
    const slug = binds[0]
    return rows.filter((r) => r.post_slug === slug && r.status === 'approved')
  }
  throw new Error(`stub-d1 does not recognise SQL: ${sql}`)
}

class Prepared {
  private binds: unknown[] = []
  constructor(
    private store: { rows: CommentRow[] },
    private sql: string
  ) {}
  bind(...args: unknown[]) {
    this.binds = args
    return this
  }
  async all<T = unknown>(): Promise<{ results: T[]; success: true }> {
    const r = matchQuery(this.sql, this.binds, this.store.rows)
    return { results: r as unknown as T[], success: true }
  }
  async first<T = unknown>(): Promise<T | null> {
    const r = matchQuery(this.sql, this.binds, this.store.rows)
    return (r[0] as unknown as T) ?? null
  }
}

export function createStubD1(seed: CommentRow[] = []) {
  const store = { rows: [...seed] }
  const stub = {
    prepare: (sql: string) => new Prepared(store, sql),
    _seed(rows: CommentRow[]) {
      store.rows.push(...rows)
    },
    _all() {
      return store.rows
    },
  }
  return stub as unknown as import('@cloudflare/workers-types').D1Database & {
    _seed(rows: CommentRow[]): void
    _all(): CommentRow[]
  }
}

export function mkComment(
  partial: Partial<CommentRow> &
    Pick<CommentRow, 'post_slug' | 'author_name' | 'body' | 'body_html'>
): CommentRow {
  return {
    id: partial.id ?? Math.floor(Math.random() * 1e9),
    author_email: partial.author_email ?? null,
    status: partial.status ?? 'approved',
    created_at: partial.created_at ?? new Date().toISOString(),
    moderated_at: partial.moderated_at ?? null,
    moderation_reason: partial.moderation_reason ?? null,
    ...partial,
  }
}
