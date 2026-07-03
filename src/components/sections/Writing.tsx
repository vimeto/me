import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChartLine, ListChecks, Orbit, Image } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeader } from '@/components/ui/section-header'
import { FilterChip } from '@/components/ui/filter-chip'
import { listPosts } from '@/lib/content/posts'
import { getFeatures } from '@/lib/content/postFeatures'
import { familyTheme } from '@/lib/tagColors'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'
import { formatTopLevel, topLevelOf, topLevelTags } from '@/lib/tags'
import type { Post } from '@/schemas/post'

const HOMEPAGE_LIMIT = 6

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function primaryFamily(post: Post): string {
  return post.tags[0] ? topLevelOf(post.tags[0]) : 'lab-notes'
}

const AFFORDANCES: Record<string, { Icon: LucideIcon; word: string }> = {
  ParamPlot: { Icon: ChartLine, word: 'interactive plot' },
  Quiz: { Icon: ListChecks, word: 'quiz' },
  LoopedSVG: { Icon: Orbit, word: 'animation' },
  Figure: { Icon: Image, word: 'figure' },
}

function MetaLine({ post, onFilterFamily }: { post: Post; onFilterFamily: (fam: string) => void }) {
  const features = getFeatures(post.slug)
  const families = Array.from(new Set(post.tags.map(topLevelOf)))
  const affordances = (features?.blocks ?? [])
    .map((b) => AFFORDANCES[b])
    .filter((a): a is { Icon: LucideIcon; word: string } => Boolean(a))
  const readMin = post.estimatedReadMin ?? features?.readMin

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
      {families.map((fam) => (
        <FilterChip
          key={fam}
          label={formatTopLevel(fam)}
          family={fam}
          active={false}
          onClick={() => onFilterFamily(fam)}
        />
      ))}
      {affordances.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-x-1">
          <span>contains:</span>
          {affordances.map((a, i) => (
            <span key={a.word} className="inline-flex items-center gap-1">
              {i > 0 && <span aria-hidden>·</span>}
              <a.Icon className="h-3 w-3 inline" aria-hidden />
              {a.word}
            </span>
          ))}
        </span>
      )}
      {readMin !== undefined && <span>· {readMin} min</span>}
    </div>
  )
}

export function Writing() {
  // `listPosts()` is module-load constant; memoise the slice the homepage shows.
  const allPosts = useMemo(() => listPosts(), [])
  const [selectedTop, setSelectedTop] = useState<string>('all')

  // Entry numbers over the FULL published list: oldest = 001, newest highest.
  const numberOf = useMemo(() => {
    const map = new Map<string, string>()
    const oldestFirst = [...allPosts].reverse()
    oldestFirst.forEach((p, i) => map.set(p.slug, String(i + 1).padStart(3, '0')))
    return map
  }, [allPosts])

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
          <SectionHeader
            number="05"
            title="WRITING"
            titleStyle={{ viewTransitionName: 'writing-title' }}
          />

          <div
            className="flex flex-wrap gap-2 mb-8"
            style={{ viewTransitionName: 'writing-filters' }}
          >
            <FilterChip
              label="All"
              active={selectedTop === 'all'}
              onClick={() => setSelectedTop('all')}
            />
            {usedTopTags.map((tag) => (
              <FilterChip
                key={tag}
                label={formatTopLevel(tag)}
                family={tag}
                active={selectedTop === tag}
                onClick={() => setSelectedTop(tag)}
              />
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <p className="text-sm text-muted-foreground">No posts under that tag yet.</p>
          )}

          <motion.div
            key={selectedTop}
            variants={staggerChildren(0.05)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {filteredPosts.map((post) => (
              <motion.article
                key={post.slug}
                variants={fadeRise}
                className="grid gap-x-4 border-b border-border/25 pb-5 pt-4 pl-4 transition-colors hover:bg-muted/60 sm:grid-cols-[1fr_auto]"
                style={{ borderLeft: `2px solid ${familyTheme(primaryFamily(post)).stroke}` }}
              >
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="mr-2 align-baseline font-mono text-xs text-ink tabular-nums">
                      {numberOf.get(post.slug)}
                    </span>
                    <Link
                      to={post.permalink}
                      className="align-baseline font-serif text-xl font-medium leading-snug transition-colors hover:text-ink"
                    >
                      {post.title}
                    </Link>
                  </div>
                  <time
                    dateTime={post.publishedAt}
                    className="font-mono text-xs tabular-nums text-muted-foreground sm:hidden"
                  >
                    {formatDate(post.publishedAt)}
                  </time>
                  <p className="text-sm">{post.summary}</p>
                  <MetaLine post={post} onFilterFamily={setSelectedTop} />
                </div>
                <time
                  dateTime={post.publishedAt}
                  className="hidden whitespace-nowrap text-right font-mono text-xs tabular-nums text-muted-foreground sm:block"
                >
                  {formatDate(post.publishedAt)}
                </time>
              </motion.article>
            ))}
          </motion.div>

          {allPosts.length > HOMEPAGE_LIMIT && (
            <div className="mt-8 text-sm">
              <Link
                to="/blog"
                viewTransition
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
