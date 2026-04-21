import { useEffect, useState } from 'react'
import type { PublicComment } from '@/lib/comments'
import { fetchComments } from '@/lib/comments'

type Props = {
  slug: string
  // Bump to force a re-fetch after a successful submission (without this,
  // useEffect's dep array can't detect that a new comment was added).
  refreshKey?: number
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function CommentList({ slug, refreshKey = 0 }: Props) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; comments: PublicComment[] }
    | { status: 'error'; message: string }
  >({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchComments(slug)
      .then((comments) => {
        if (!cancelled) setState({ status: 'ready', comments })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'failed'
        if (!cancelled) setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [slug, refreshKey])

  if (state.status === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading comments…</p>
  }
  if (state.status === 'error') {
    return <p className="text-sm text-destructive">Could not load comments ({state.message}).</p>
  }
  if (state.comments.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments yet. Be the first.</p>
  }

  return (
    <ul className="space-y-6 list-none pl-0">
      {state.comments.map((c) => (
        <li key={c.id} className="border-l-2 border-border pl-4">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-semibold text-sm">{c.author}</span>
            <time dateTime={c.createdAt} className="text-xs text-muted-foreground tabular-nums">
              {formatRelative(c.createdAt)}
            </time>
          </div>
          <div
            className="text-sm leading-relaxed comment-body"
            dangerouslySetInnerHTML={{ __html: c.bodyHtml }}
          />
        </li>
      ))}
    </ul>
  )
}
