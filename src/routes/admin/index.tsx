import { useCallback, useEffect, useState } from 'react'
import {
  approveComment,
  deleteComment,
  listAdminComments,
  rejectComment,
  type AdminComment,
  type AdminStatus,
} from '@/lib/admin'

const TABS: AdminStatus[] = ['pending', 'approved', 'rejected']

type Query =
  | { status: 'loading' }
  | { status: 'ready'; rows: AdminComment[] }
  | { status: 'error'; message: string }

export default function AdminPage() {
  const [tab, setTab] = useState<AdminStatus>('pending')
  const [query, setQuery] = useState<Query>({ status: 'loading' })

  const refresh = useCallback((status: AdminStatus) => {
    setQuery({ status: 'loading' })
    listAdminComments(status)
      .then((rows) => setQuery({ status: 'ready', rows }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'failed'
        setQuery({ status: 'error', message })
      })
  }, [])

  useEffect(() => {
    refresh(tab)
  }, [tab, refresh])

  async function onApprove(id: number) {
    await approveComment(id)
    refresh(tab)
  }
  async function onReject(id: number) {
    const reason = window.prompt('Rejection reason (optional):') ?? undefined
    await rejectComment(id, reason || undefined)
    refresh(tab)
  }
  async function onDelete(id: number) {
    if (!window.confirm('Permanently delete this comment? This cannot be undone.')) return
    await deleteComment(id)
    refresh(tab)
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Comment moderation</h1>
          <p className="text-sm text-muted-foreground">
            Gated by Cloudflare Access. If you can see this page, you're signed in.
          </p>
        </header>

        <nav className="flex gap-2 mb-6 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`px-4 py-2 text-sm font-semibold capitalize -mb-px border-b-2 ${
                tab === t
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>

        {query.status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
        {query.status === 'error' && (
          <p className="text-sm text-destructive">
            Failed to load: {query.message}. If this says "unauthenticated", your Access session
            probably expired — reload to re-authenticate.
          </p>
        )}
        {query.status === 'ready' && query.rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        )}
        {query.status === 'ready' && query.rows.length > 0 && (
          <ul className="space-y-6">
            {query.rows.map((r) => (
              <AdminRow
                key={r.id}
                row={r}
                onApprove={() => onApprove(r.id)}
                onReject={() => onReject(r.id)}
                onDelete={() => onDelete(r.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function AdminRow({
  row,
  onApprove,
  onReject,
  onDelete,
}: {
  row: AdminComment
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}) {
  return (
    <li className="border border-border rounded p-4 space-y-3">
      <div className="flex flex-wrap items-baseline gap-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground text-sm">{row.author_name}</span>
        {row.author_email && <span>&lt;{row.author_email}&gt;</span>}
        <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>
        <span>on /blog/{row.post_slug}</span>
        <span className="ml-auto uppercase font-semibold">{row.status}</span>
      </div>
      <div
        className="text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: row.body_html }}
      />
      {row.moderation_reason && (
        <p className="text-xs text-muted-foreground italic">Note: {row.moderation_reason}</p>
      )}
      <div className="flex gap-2 pt-2 border-t border-border">
        {row.status !== 'approved' && (
          <button
            type="button"
            onClick={onApprove}
            className="px-3 py-1 text-xs font-semibold rounded bg-foreground text-background hover:opacity-90"
          >
            Approve
          </button>
        )}
        {row.status !== 'rejected' && (
          <button
            type="button"
            onClick={onReject}
            className="px-3 py-1 text-xs font-semibold rounded border border-border hover:bg-muted"
          >
            Reject
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-1 text-xs font-semibold rounded border border-destructive text-destructive hover:bg-destructive/10 ml-auto"
        >
          Delete
        </button>
      </div>
    </li>
  )
}
