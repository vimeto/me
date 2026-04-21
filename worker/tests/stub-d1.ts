/**
 * Tiny in-memory D1 stub. Implements enough of Cloudflare's D1 binding surface
 * for Hono route tests to run under plain `tsx` — no Miniflare / workerd
 * required. Schema-agnostic: tests seed rows directly into the `rows` array.
 */

import type { CommentRow, SubmissionLogRow } from '../src/types'

type Store = {
  rows: CommentRow[]
  submissions: SubmissionLogRow[]
  nextId: number
}
type RunMeta = { changes: number; last_row_id: number }

type MatchResult =
  | { kind: 'select'; rows: unknown[] }
  | { kind: 'run'; meta: RunMeta; returning?: unknown }

function matchQuery(sql: string, binds: unknown[], store: Store): MatchResult {
  const s = sql.replace(/\s+/g, ' ').trim()

  // Public GET /api/comments → approved-only list scoped to a post slug.
  if (s.includes('FROM comments') && s.includes("status = 'approved'") && s.startsWith('SELECT')) {
    const slug = binds[0]
    return {
      kind: 'select',
      rows: store.rows
        .filter((r) => r.post_slug === slug && r.status === 'approved')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }
  }

  // Admin GET /api/admin/comments?status=...  — filter by status, all columns.
  if (s.startsWith('SELECT') && s.includes('FROM comments') && s.includes('WHERE status = ?')) {
    const status = binds[0]
    return {
      kind: 'select',
      rows: store.rows
        .filter((r) => r.status === status)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }
  }

  // Rate-limit lookup: submissions by ip hash inside a time window.
  if (s.startsWith('SELECT') && s.includes('FROM submission_log')) {
    const [ipHash, since] = binds as [string, string]
    return {
      kind: 'select',
      rows: store.submissions.filter((r) => r.client_ip_hash === ipHash && r.submitted_at > since),
    }
  }

  // Admin approve: UPDATE ... SET status='approved'
  if (s.startsWith('UPDATE comments') && s.includes("status = 'approved'")) {
    const [moderatedAt, reason, id] = binds as [string, string, number]
    const row = store.rows.find((r) => r.id === id)
    if (!row) return { kind: 'run', meta: { changes: 0, last_row_id: 0 } }
    row.status = 'approved'
    row.moderated_at = moderatedAt
    row.moderation_reason = reason
    return { kind: 'run', meta: { changes: 1, last_row_id: id } }
  }

  // Admin reject: UPDATE ... SET status='rejected'
  if (s.startsWith('UPDATE comments') && s.includes("status = 'rejected'")) {
    const [moderatedAt, reason, id] = binds as [string, string, number]
    const row = store.rows.find((r) => r.id === id)
    if (!row) return { kind: 'run', meta: { changes: 0, last_row_id: 0 } }
    row.status = 'rejected'
    row.moderated_at = moderatedAt
    row.moderation_reason = reason
    return { kind: 'run', meta: { changes: 1, last_row_id: id } }
  }

  // Admin delete.
  if (s.startsWith('DELETE FROM comments')) {
    const [id] = binds as [number]
    const idx = store.rows.findIndex((r) => r.id === id)
    if (idx < 0) return { kind: 'run', meta: { changes: 0, last_row_id: 0 } }
    store.rows.splice(idx, 1)
    return { kind: 'run', meta: { changes: 1, last_row_id: id } }
  }

  // Insert comment (RETURNING id).
  if (s.startsWith('INSERT INTO comments')) {
    const [
      post_slug,
      author_name,
      author_email,
      body,
      body_html,
      status,
      created_at,
      moderation_reason,
      client_ip_hash,
      user_agent,
    ] = binds as [
      string,
      string,
      string | null,
      string,
      string,
      CommentRow['status'],
      string,
      string | null,
      string,
      string | null,
    ]
    const id = store.nextId++
    const row: CommentRow & { client_ip_hash: string; user_agent: string | null } = {
      id,
      post_slug,
      author_name,
      author_email,
      body,
      body_html,
      status,
      created_at,
      moderated_at: null,
      moderation_reason,
      client_ip_hash,
      user_agent,
    }
    store.rows.push(row)
    // `.first()` on a RETURNING insert is how Hono/D1 pulls the new id.
    return { kind: 'select', rows: [{ id }] }
  }

  // Insert submission log entry.
  if (s.startsWith('INSERT INTO submission_log')) {
    const [client_ip_hash, submitted_at] = binds as [string, string]
    store.submissions.push({ client_ip_hash, submitted_at })
    return { kind: 'run', meta: { changes: 1, last_row_id: 0 } }
  }

  throw new Error(`stub-d1 does not recognise SQL: ${sql}`)
}

class Prepared {
  private binds: unknown[] = []
  constructor(
    private store: Store,
    private sql: string
  ) {}
  bind(...args: unknown[]) {
    this.binds = args
    return this
  }
  async all<T = unknown>(): Promise<{ results: T[]; success: true }> {
    const r = matchQuery(this.sql, this.binds, this.store)
    if (r.kind !== 'select') throw new Error(`all() called on non-SELECT: ${this.sql}`)
    return { results: r.rows as T[], success: true }
  }
  async first<T = unknown>(): Promise<T | null> {
    const r = matchQuery(this.sql, this.binds, this.store)
    if (r.kind !== 'select') throw new Error(`first() called on non-SELECT: ${this.sql}`)
    return ((r.rows[0] as T) ?? null) as T | null
  }
  async run(): Promise<{ success: true; meta: RunMeta }> {
    const r = matchQuery(this.sql, this.binds, this.store)
    if (r.kind !== 'run') throw new Error(`run() called on SELECT: ${this.sql}`)
    return { success: true, meta: r.meta }
  }
}

export function createStubD1(seed: CommentRow[] = []) {
  const store: Store = {
    rows: [...seed],
    submissions: [],
    nextId: seed.length > 0 ? Math.max(...seed.map((r) => r.id)) + 1 : 1,
  }
  const stub = {
    prepare: (sql: string) => new Prepared(store, sql),
    _seed(rows: CommentRow[]) {
      store.rows.push(...rows)
    },
    _all() {
      return store.rows
    },
    _submissions() {
      return store.submissions
    },
    _seedSubmissions(rows: SubmissionLogRow[]) {
      store.submissions.push(...rows)
    },
  }
  return stub as unknown as import('@cloudflare/workers-types').D1Database & {
    _seed(rows: CommentRow[]): void
    _all(): CommentRow[]
    _submissions(): SubmissionLogRow[]
    _seedSubmissions(rows: SubmissionLogRow[]): void
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
