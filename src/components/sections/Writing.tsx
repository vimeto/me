import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { SectionHeader } from '@/components/ui/section-header'
import { listPosts } from '@/lib/content/posts'
import { formatTopLevel, topLevelOf, topLevelTags } from '@/lib/tags'

const HOMEPAGE_LIMIT = 6

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function Writing() {
  // `listPosts()` is module-load constant; memoise the slice the homepage shows.
  const allPosts = useMemo(() => listPosts(), [])
  const [selectedTop, setSelectedTop] = useState<string>('all')

  // Only show top-level tags that at least one published post uses.
  const usedTopTags = useMemo(() => {
    const used = new Set<string>()
    for (const p of allPosts) {
      for (const t of p.tags) used.add(topLevelOf(t))
    }
    return topLevelTags.filter((t) => used.has(t))
  }, [allPosts])

  const filteredPosts = useMemo(() => {
    if (selectedTop === 'all') return allPosts.slice(0, HOMEPAGE_LIMIT)
    return allPosts
      .filter((p) => p.tags.some((t) => topLevelOf(t) === selectedTop))
      .slice(0, HOMEPAGE_LIMIT)
  }, [allPosts, selectedTop])

  return (
    <section id="writing" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <SectionHeader number="05" title="WRITING" />

          <div className="flex flex-wrap gap-2 mb-8">
            <FilterChip
              label="All"
              active={selectedTop === 'all'}
              onClick={() => setSelectedTop('all')}
            />
            {usedTopTags.map((tag) => (
              <FilterChip
                key={tag}
                label={formatTopLevel(tag)}
                active={selectedTop === tag}
                onClick={() => setSelectedTop(tag)}
              />
            ))}
          </div>

          <div className="space-y-6">
            {filteredPosts.length === 0 && (
              <p className="text-sm text-muted-foreground">No posts under that tag yet.</p>
            )}
            {filteredPosts.map((post, index) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="border-b border-border pb-6"
              >
                <div className="flex justify-between items-start mb-2 gap-4">
                  <h3 className="font-serif font-medium text-xl flex-1 leading-snug">
                    <Link to={post.permalink} className="hover:text-ink transition-colors">
                      {post.title}
                    </Link>
                  </h3>
                  <time
                    dateTime={post.publishedAt}
                    className="text-sm text-muted-foreground whitespace-nowrap"
                  >
                    {formatDate(post.publishedAt)}
                  </time>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Array.from(new Set(post.tags.map(topLevelOf))).map((t) => (
                    <span
                      key={t}
                      className="text-xs text-muted-foreground border border-border rounded-sm px-1.5 py-0.5"
                    >
                      {formatTopLevel(t)}
                    </span>
                  ))}
                </div>
                <p className="text-sm">{post.summary}</p>
              </motion.article>
            ))}
          </div>

          {allPosts.length > HOMEPAGE_LIMIT && (
            <div className="mt-8 text-sm">
              <Link
                to="/blog"
                className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
              >
                All writing →
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
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
    </button>
  )
}
