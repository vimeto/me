import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

type PagefindResult = {
  id: string
  data: () => Promise<{
    url: string
    excerpt: string
    meta?: { title?: string }
    content?: string
  }>
}

type Pagefind = {
  search: (q: string) => Promise<{ results: PagefindResult[] }>
  options?: (opts: Record<string, unknown>) => Promise<void>
}

type ResolvedResult = {
  id: string
  url: string
  title: string
  excerpt: string
}

// Pagefind serves itself from the same origin at /pagefind/pagefind.js. We
// dynamic-import it so it never ships in the main bundle and so dev/SSR won't
// blow up before the index exists.
async function loadPagefind(): Promise<Pagefind> {
  // Vite/TS can't type-check a runtime-only path, so we load via a variable.
  // The import is resolved at runtime against the built Pagefind bundle.
  const url = '/pagefind/pagefind.js'
  const mod = (await import(/* @vite-ignore */ url)) as unknown as Pagefind
  return mod
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [query, setQuery] = useState(initial)
  const [results, setResults] = useState<ResolvedResult[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const pagefindRef = useRef<Pagefind | null>(null)

  // Debounce input so we don't issue a query on every keystroke.
  const trimmed = useMemo(() => query.trim(), [query])

  useEffect(() => {
    if (!trimmed) {
      setResults(null)
      setStatus('idle')
      setMessage('')
      return
    }

    let cancelled = false
    setStatus('loading')

    const handle = window.setTimeout(async () => {
      try {
        if (!pagefindRef.current) {
          pagefindRef.current = await loadPagefind()
        }
        const pf = pagefindRef.current
        const raw = await pf.search(trimmed)
        const resolved = await Promise.all(
          raw.results.slice(0, 25).map(async (r) => {
            const d = await r.data()
            return {
              id: r.id,
              url: d.url,
              title: d.meta?.title ?? d.url,
              excerpt: d.excerpt,
            }
          })
        )
        if (cancelled) return
        setResults(resolved)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : String(err))
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [trimmed])

  // Mirror the query into the URL so results are linkable.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (trimmed) next.set('q', trimmed)
    else next.delete('q')
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true })
    }
  }, [trimmed, params, setParams])

  return (
    <section className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">SEARCH</h1>
        <label className="block">
          <span className="sr-only">Search posts</span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            className="w-full border border-border bg-background px-4 py-3 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="mt-8">
          {status === 'idle' && !trimmed && (
            <p className="text-sm text-muted-foreground">Type to search.</p>
          )}
          {status === 'loading' && <p className="text-sm text-muted-foreground">Searching…</p>}
          {status === 'error' && (
            <p className="text-sm text-red-600">
              Search unavailable{message ? `: ${message}` : '.'}
            </p>
          )}
          {status === 'ready' && results && (
            <>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches for “{trimmed}”.</p>
              ) : (
                <ul className="space-y-6">
                  {results.map((r) => (
                    <li key={r.id} className="border-b border-border pb-4">
                      <h2 className="font-bold text-lg">
                        <a href={r.url} className="hover:underline underline-offset-4">
                          {r.title}
                        </a>
                      </h2>
                      <p
                        className="text-sm mt-1 text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: r.excerpt }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
