import { Link } from 'react-router'
import type { ReactNode } from 'react'
import type { Post } from '@/schemas/post'

type Props = {
  meta: Post
  children: ReactNode
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function PostLayout({ meta, children }: Props) {
  return (
    <article className="px-6 py-16 max-w-3xl mx-auto">
      <header className="mb-10 pb-6 border-b border-border">
        <Link
          to="/blog"
          className="text-sm text-muted-foreground hover:text-foreground inline-block mb-6"
        >
          ← All writing
        </Link>
        <h1 className="text-3xl font-bold leading-tight mb-3">{meta.title}</h1>
        <p className="text-base text-muted-foreground mb-4">{meta.summary}</p>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <time dateTime={meta.publishedAt}>{formatDate(meta.publishedAt)}</time>
          {meta.category && <span>{meta.category}</span>}
          {meta.estimatedReadMin && <span>{meta.estimatedReadMin} min read</span>}
          {meta.status === 'draft' && (
            <span className="font-bold uppercase tracking-wide">Draft</span>
          )}
        </div>
      </header>
      <div className="prose prose-slate dark:prose-invert max-w-none">{children}</div>
    </article>
  )
}
