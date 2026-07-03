import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { motion, useScroll } from 'framer-motion'
import { MDXProvider } from '@mdx-js/react'
import type { Post } from '@/schemas/post'
import { mdxComponents } from '../registry'
import { formatTopLevel, topLevelOf } from '@/lib/tags'
import { familyTheme } from '@/lib/tagColors'
import { RuleDraw } from '@/components/ui/rule-draw'

type Props = {
  meta: Post
  children: ReactNode
}

const DATE_LOCALES: Record<string, string> = { en: 'en-US', fi: 'fi-FI' }

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(DATE_LOCALES[lang] ?? 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Reduce a literal `rgb(r g b)` token to a softer border alpha (same trick as FilterChip).
function softBorder(stroke: string): string {
  return stroke.replace(/\)\s*$/, ' / 0.45)')
}

// Permalink for a given language of the post: canonical language lives at
// /blog/<slug>, every other language at /blog/<slug>/<lang>.
function langPermalink(meta: Post, lang: string): string {
  return lang === meta.languages[0] ? `/blog/${meta.slug}` : `/blog/${meta.slug}/${lang}`
}

export function PostLayout({ meta, children }: Props) {
  const { scrollYProgress } = useScroll()
  const families = Array.from(new Set(meta.tags.map(topLevelOf)))
  const multilingual = meta.languages.length > 1

  return (
    <article
      className="px-6 py-16 max-w-3xl mx-auto"
      data-pagefind-body
      data-pagefind-meta={`title:${meta.title}`}
    >
      <motion.div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-[60] h-[2px] bg-ink origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      <header className="mb-10">
        <Link
          to="/blog"
          className="text-sm text-muted-foreground hover:text-foreground inline-block mb-6"
        >
          ← All writing
        </Link>
        <h1 className="font-serif text-3xl md:text-4xl font-medium leading-tight mb-3">
          {meta.title}
        </h1>
        <p className="font-serif italic text-lg text-muted-foreground mb-4">{meta.summary}</p>
        {(families.length > 0 || multilingual) && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {families.map((t) => {
                const theme = familyTheme(t)
                return (
                  <span
                    key={t}
                    className="font-mono text-[11px] px-2 py-0.5 border"
                    style={{ color: theme.text, borderColor: softBorder(theme.stroke) }}
                  >
                    {formatTopLevel(t)}
                  </span>
                )
              })}
            </div>
            {multilingual && (
              <nav
                aria-label="Post language"
                className="flex items-center gap-1.5 font-mono text-[11px]"
              >
                {meta.languages.map((l) =>
                  l === meta.lang ? (
                    <span
                      key={l}
                      aria-current="true"
                      className="px-2 py-0.5 border border-foreground bg-foreground text-background uppercase tracking-wide"
                    >
                      {l}
                    </span>
                  ) : (
                    <Link
                      key={l}
                      to={langPermalink(meta, l)}
                      className="px-2 py-0.5 border border-border/60 uppercase tracking-wide text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    >
                      {l}
                    </Link>
                  )
                )}
              </nav>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums">
          <img
            src="/avatar.png"
            alt=""
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            className="h-8 w-8 rounded-full object-cover bg-muted"
          />
          <span className="font-medium text-foreground">Vilhelm Toivonen</span>
          <span aria-hidden>·</span>
          <time dateTime={meta.publishedAt}>{formatDate(meta.publishedAt, meta.lang)}</time>
          {meta.category && (
            <>
              <span aria-hidden>·</span>
              <span>{meta.category}</span>
            </>
          )}
          {meta.estimatedReadMin && (
            <>
              <span aria-hidden>·</span>
              <span>{meta.estimatedReadMin} min read</span>
            </>
          )}
          {meta.status === 'draft' && (
            <>
              <span aria-hidden>·</span>
              <span className="font-bold uppercase tracking-wide">Draft</span>
            </>
          )}
        </div>
        <RuleDraw className="mt-6 h-[2px] bg-foreground" />
      </header>
      <div className="prose prose-slate dark:prose-invert max-w-none font-serif prose-lg prose-headings:font-sans prose-headings:tracking-tight prose-code:font-mono prose-pre:font-mono">
        <MDXProvider components={mdxComponents}>{children}</MDXProvider>
      </div>
    </article>
  )
}
