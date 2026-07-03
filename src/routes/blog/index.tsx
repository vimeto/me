import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router'
import { Search, ChartLine, ListChecks, Orbit, Image } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FilterChip } from '@/components/ui/filter-chip'
import { MiniFigure } from '@/components/blog/MiniFigure'
import { SlugGlyph } from '@/components/blog/SlugGlyph'
import { listPosts } from '@/lib/content/posts'
import { getFeatures } from '@/lib/content/postFeatures'
import { familyTheme } from '@/lib/tagColors'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'
import { formatTopLevel, topLevelOf, topLevelTags } from '@/lib/tags'
import type { Post } from '@/schemas/post'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
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

function Thumbnail({ slug, className }: { slug: string; className?: string }) {
  const plot = getFeatures(slug)?.firstPlot
  if (plot) {
    return (
      <MiniFigure
        compute={plot.compute}
        params={plot.params}
        kind={plot.kind}
        className={className}
      />
    )
  }
  return <SlugGlyph slug={slug} className={className} />
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
      {post.languages.length > 1 && (
        <span className="uppercase tracking-wide" title="Available languages">
          · {post.languages.join(' / ')}
        </span>
      )}
    </div>
  )
}

export default function BlogIndex() {
  const allPosts = useMemo(() => listPosts(), [])
  const [selectedTop, setSelectedTop] = useState<string>('all')

  // Entry numbers over the FULL published list: oldest = 001, newest highest.
  // Stable under filtering.
  const numberOf = useMemo(() => {
    const map = new Map<string, string>()
    const oldestFirst = [...allPosts].reverse()
    oldestFirst.forEach((p, i) => map.set(p.slug, String(i + 1).padStart(3, '0')))
    return map
  }, [allPosts])

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

  const isAll = selectedTop === 'all'
  const featured = isAll ? allPosts[0] : undefined

  // Year groups over the filtered list, minus the featured post when showing all.
  const yearGroups = useMemo(() => {
    const rows = featured ? filteredPosts.filter((p) => p.slug !== featured.slug) : filteredPosts
    const groups = new Map<number, Post[]>()
    for (const p of rows) {
      const year = new Date(p.publishedAt).getFullYear()
      const arr = groups.get(year) ?? []
      arr.push(p)
      groups.set(year, arr)
    }
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0])
  }, [filteredPosts, featured])

  return (
    <section className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="font-serif font-normal text-4xl md:text-5xl tracking-wide leading-[1.05]"
            style={{ viewTransitionName: 'writing-title' }}
          >
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

        <div
          className="flex flex-wrap gap-2 mb-8"
          style={{ viewTransitionName: 'writing-filters' }}
        >
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
                family={tag}
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

        {featured && (
          <article
            className="mb-12 border border-foreground/60 p-6 md:grid md:grid-cols-[2fr_3fr] md:gap-6"
            style={{ borderTop: `3px solid ${familyTheme(primaryFamily(featured)).stroke}` }}
          >
            <div className="mb-4 h-44 md:mb-0 md:h-full">
              <Thumbnail slug={featured.slug} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-ink tabular-nums">
                  {numberOf.get(featured.slug)}
                </span>
                <span className="font-mono text-xs text-muted-foreground tracking-wide">
                  LATEST
                </span>
              </div>
              <h2 className="font-serif font-medium text-2xl md:text-3xl leading-snug">
                <Link to={featured.permalink} className="transition-colors hover:text-ink">
                  {featured.title}
                </Link>
              </h2>
              <p className="text-sm">{featured.summary}</p>
              <MetaLine post={featured} onFilterFamily={setSelectedTop} />
            </div>
          </article>
        )}

        <motion.div
          key={selectedTop}
          variants={staggerChildren(0.05)}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {yearGroups.map(([year, posts]) => (
            <motion.div key={year} variants={staggerChildren(0.05)} className="mt-10 first:mt-0">
              <div className="mb-4 border-b border-border/25 pb-1 font-mono text-xs tabular-nums text-muted-foreground">
                {year}
              </div>
              {posts.map((post) => (
                <motion.article
                  key={post.slug}
                  variants={fadeRise}
                  className="grid gap-x-4 border-b border-border/25 pb-5 pt-4 pl-4 transition-colors hover:bg-muted/60 sm:grid-cols-[auto_1fr_auto]"
                  style={{
                    borderLeft: `2px solid ${familyTheme(primaryFamily(post)).stroke}`,
                  }}
                >
                  <div className="hidden h-14 w-20 border border-border/25 sm:block">
                    <Thumbnail slug={post.slug} />
                  </div>
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
          ))}
        </motion.div>
      </div>
    </section>
  )
}
