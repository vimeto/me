import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import type { Plugin } from 'vite'

// Build-time extraction of per-post "features" — which MDX blocks a post uses,
// the parameters of its first <ParamPlot> (so the index can render a real
// thumbnail), and a rough read-time estimate. Exposed to the app as the virtual
// module `virtual:post-features` (default export keyed by slug). Cheap enough
// (~15 files) to re-scan on every load so `pnpm dev` picks up edits.

const VIRTUAL_ID = 'virtual:post-features'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const postsDir = path.resolve(__dirname, '..', 'content', 'posts')

const BLOCK_RE = /<(ParamPlot|Quiz|LoopedSVG|Figure|Callout)[\s/>]/g

type FirstPlot = {
  compute: string
  kind: string
  params: Record<string, unknown>
} | null

type PostFeatures = {
  blocks: string[]
  firstPlot: FirstPlot
  readMin: number
}

/**
 * From `body`, starting at the index of an opening `{`, return the substring
 * inside the matching close brace (exclusive of the outermost pair). Tracks
 * string literals so braces inside quotes don't throw off the depth count.
 * Returns null if the braces never balance.
 */
function balancedInner(body: string, openIdx: number): string | null {
  let depth = 0
  let quote: string | null = null
  for (let i = openIdx; i < body.length; i++) {
    const ch = body[i]
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return body.slice(openIdx + 1, i)
    }
  }
  return null
}

function extractFirstPlot(body: string, slug: string): FirstPlot {
  const tagStart = body.indexOf('<ParamPlot')
  if (tagStart === -1) return null
  const rest = body.slice(tagStart)

  const compute = rest.match(/compute="([^"]*)"/)?.[1]
  const kind = rest.match(/kind="([^"]*)"/)?.[1]
  if (!compute || !kind) return null

  const paramsAttr = rest.indexOf('params={')
  if (paramsAttr === -1) return null
  // `params={` — the brace right after `=` opens the JSX expression container;
  // its balanced inner is the object literal `{ ... }`.
  const jsxOpen = paramsAttr + 'params='.length
  const inner = balancedInner(rest, jsxOpen)
  if (inner === null) return null

  try {
    const params = new Function('return (' + inner + ')')() as Record<string, unknown>
    if (typeof params !== 'object' || params === null) return null
    return { compute, kind, params }
  } catch (err) {
    console.warn(`[post-features] ${slug}: failed to parse ParamPlot params — ${String(err)}`)
    return null
  }
}

function extractBlocks(body: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  BLOCK_RE.lastIndex = 0
  while ((m = BLOCK_RE.exec(body)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      out.push(m[1])
    }
  }
  return out
}

function estimateReadMin(body: string): number {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/^\s*(import|export)\b.*$/gm, ' ') // import/export lines
    .replace(/<[^>]+>/g, ' ') // JSX tags
    .replace(/[#>*_~\-|=[\]()!]/g, ' ') // markdown punctuation
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

function scan(): Record<string, PostFeatures> {
  const out: Record<string, PostFeatures> = {}
  let entries: string[]
  try {
    entries = fs.readdirSync(postsDir)
  } catch {
    return out
  }
  for (const dir of entries) {
    const file = path.join(postsDir, dir, 'index.mdx')
    let raw: string
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const { data, content } = matter(raw)
    const slug = typeof data.slug === 'string' ? data.slug : dir
    out[slug] = {
      blocks: extractBlocks(content),
      firstPlot: extractFirstPlot(content, slug),
      readMin: estimateReadMin(content),
    }
  }
  return out
}

export function postFeaturesPlugin(): Plugin {
  return {
    name: 'post-features',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      // Re-scan per load so dev picks up MDX edits; watch each file so an edit
      // invalidates this module.
      const features = scan()
      try {
        for (const dir of fs.readdirSync(postsDir)) {
          this.addWatchFile(path.join(postsDir, dir, 'index.mdx'))
        }
      } catch {
        // no-op: nothing to watch if the dir is missing
      }
      return `export default ${JSON.stringify(features)}`
    },
  }
}
