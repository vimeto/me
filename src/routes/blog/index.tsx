import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { listPosts } from '@/lib/content/posts'
import { formatTopLevel, topLevelOf, topLevelTags } from '@/lib/tags'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogIndex() {
  const allPosts = useMemo(() => listPosts(), [])
  const [selectedTop, setSelectedTop] = useState<string>('all')

  const usedTopTags = useMemo(() => {
    const used = new Set<string>()
    for (const p of allPosts) {
      for (const t of p.tags) used.add(topLevelOf(t))
    }
    return topLevelTags.filter((t) => used.has(t))
  }, [allPosts])

  const filteredPosts = useMemo(() => {
    if (selectedTop === 'all') return allPosts
    return allPosts.filter((p) => p.tags.some((t) => topLevelOf(t) === selectedTop))
  }, [allPosts, selectedTop])

  return (
    <section className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif font-normal text-4xl md:text-5xl tracking-wide leading-[1.05]">
            WRITING
          </h1>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            aria-label="Search posts"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search</span>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <FilterChip
            label="All"
            count={allPosts.length}
            active={selectedTop === 'all'}
            onClick={() => setSelectedTop('all')}
          />
          {usedTopTags.map((tag) => {
            const count = allPosts.filter((p) => p.tags.some((t) => topLevelOf(t) === tag)).length
            return (
              <FilterChip
                key={tag}
                label={formatTopLevel(tag)}
                count={count}
                active={selectedTop === tag}
                onClick={() => setSelectedTop(tag)}
              />
            )
          })}
        </div>

        {filteredPosts.length === 0 && (
          <p className="text-sm text-muted-foreground">No posts under that tag yet.</p>
        )}

        <div className="space-y-6">
          {filteredPosts.map((post) => (
            <article key={post.slug} className="border-b border-border pb-6">
              <div className="flex justify-between items-start mb-2 gap-4">
                <h2 className="font-serif font-medium text-xl flex-1 leading-snug">
                  <Link to={post.permalink} className="hover:text-ink transition-colors">
                    {post.title}
                  </Link>
                </h2>
                <time
                  dateTime={post.publishedAt}
                  className="text-sm text-muted-foreground whitespace-nowrap"
                >
                  {formatDate(post.publishedAt)}
                </time>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Array.from(new Set(post.tags.map(topLevelOf))).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTop(t)}
                    className="text-xs text-muted-foreground border border-border rounded-sm px-1.5 py-0.5 hover:border-foreground"
                  >
                    {formatTopLevel(t)}
                  </button>
                ))}
              </div>
              <p className="text-sm">{post.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-1 border transition-all ${
        active ? 'border-2 border-foreground font-bold' : 'border-border hover:border-foreground'
      }`}
    >
      {label}
      {typeof count === 'number' && (
        <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  )
}
