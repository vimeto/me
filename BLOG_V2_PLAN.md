# Blog v2 — Technical Plan

Author: Vilhelm Toivonen
Last updated: 2026-04-21
Status: Planning

---

## 0. TL;DR

The personal site (Vite + React 19 + TS + Tailwind + Framer Motion) grows a `/blog` section that hosts rich interactive technical explainers. Posts are authored as MDX files, embedding React components from a **Zod-validated component registry**. An LLM can produce posts through two interchangeable paths: a **Git PR path** (Claude Code + GitHub MCP) that becomes the **canonical, prerendered, SEO-indexed** source of truth, or an **authenticated Worker path** that writes drafts + previews to a Cloudflare Worker + D1 + R2 backend with `noindex`. Publishing = promoting a Worker draft into the git repo (or authoring in git directly). Both paths validate against the **same Zod schema**. The same Worker also serves a **custom comments system**: anonymous by default for readers, with an "Author" reply path gated by **Cloudflare Access + GitHub OAuth**. Nothing rewrites the existing SPA shell — the blog lives alongside it.

Ship order (see §12): scaffold → registry + first block → validation pipeline → more blocks + visual regression → prerender/SEO → Worker backend for posts → comments → LLM authoring → polish. ~7–8 focused days spread over 3–4 weeks.

---

## 1. Goals & non-goals

### Goals
- Author rich, interactive technical explainers. Examples we want to support on day one:
  - **GPTQ flipping-range visualization**: slider over group size / clip range / seed → online algorithm re-runs and redraws histograms and reconstruction error.
  - **Latency playground**: sliders over device throughput, KV-cache refill time, network RTT, context length → bars comparing on-device vs cloud first-token latency.
  - **Quiz**: small 2–5-question check-your-understanding after a section.
  - **Looped animation**: Rive/Lottie looped motion for mechanism diagrams.
  - **Figures with captions, Callouts, code blocks, LaTeX math, inline images.**
- Robust, **pre-publish validation**: frontmatter schema, interactive-block prop schema, literal-prop enforcement, TypeScript checks, link checks, visual regression snapshots.
- **LLM-first authoring** from Claude Code: schema-driven, with a repair loop.
- **Two publishing paths** with identical semantics:
  - Default: commit `.mdx` → GitHub → Cloudflare Pages build.
  - Authenticated: POST to Cloudflare Worker → D1 + R2.
- **Comments**: anonymous by default with a distinct "Author" reply path.
- Scales cleanly to hundreds of posts (code-splitting, prerendering, fast lists).
- Good SEO (static HTML per post), good accessibility, good mobile.

### Non-goals (for v2)
- Multi-author support.
- Real-time collaborative editing.
- Rich client-side search at launch (Pagefind added in Phase 8).
- WYSIWYG editor.
- Email newsletter (deferred).
- i18n.

---

## 2. Stack decisions

| Layer | Pick | Alternative considered | Why |
| --- | --- | --- | --- |
| App framework | **Vite + React 19 (stay)** | Astro 5 + islands | Preserves existing SPA; MDX + Velite + prerender cover content needs; SEO handled by `vite-react-ssg` |
| MDX loader | **`@mdx-js/rollup`** | `@next/mdx`, Astro MDX | Native Vite, MDX 3, well-maintained |
| Content indexer | **`import.meta.glob` + `remark-mdx-frontmatter` + Zod** | Velite, Contentlayer (dead) | Vite-native, zero build-step, MDX imports become real ES modules; revisit Velite if/when archive grows past ~100 posts or we need an asset pipeline |
| Prerender | **vite-react-ssg** | Astro, Next.js SSG | Minimal; stays inside Vite |
| Viz primitives | **visx + d3-scale + d3-shape** | Recharts, Nivo, Observable Plot | Low-level, composable, right abstraction for bespoke explainers |
| Motion | **Framer Motion (have) + Rive** | Lottie | Rive is 10–15× smaller, 60 fps, free runtime; Lottie as fallback only if AE assets already exist |
| Math | **KaTeX (rehype-katex)** | MathJax | Fast, SSR-friendly |
| Code | **Shiki (@shikijs/rehype)** | Prism, highlight.js | Accurate, dark-mode, no runtime cost |
| Schema | **Zod v4** | Valibot, ArkType | Universal, Claude structured-outputs supports it, shared with Worker |
| Unit tests | **Vitest** | Jest | Vite-native |
| Visual regression | **Playwright `toHaveScreenshot`** | Chromatic, Percy | Free, self-hosted, minimal |
| Dev gallery | **Ladle** | Storybook | Vite-native, tiny |
| Router | **React Router v7** | TanStack Router | Mature, loader/data-router API suits pre-render |
| Hosting (static) | **Cloudflare Pages** | Vercel, Netlify, GH Pages | Unlimited bandwidth, fast previews, free tier fits |
| Hosting (API) | **Cloudflare Workers + Hono** | Deno Deploy, Bun on Fly | Colocated with Pages, cheapest, edge |
| Metadata DB | **Cloudflare D1** | Supabase, Turso | Zero-ops, co-located, fine for blog scale |
| Blob store | **Cloudflare R2** | S3 | Zero egress, custom domain, co-located |
| Rate limit | **CF Rate Limit binding** | KV custom | Native, simple |
| Spam | **Turnstile + Claude Haiku moderation** | reCAPTCHA, hCaptcha | Privacy-preserving, invisible UX, cheap |
| Owner auth | **Cloudflare Access (GitHub OAuth)** | Custom JWT, Auth0 | Zero custom code for a single author |
| LLM authoring | **Claude Code + GitHub MCP + custom `blog-publisher-mcp`** | Raw prompts, Keystatic | Leverages schema, enforces gates before commit |
| CI | **GitHub Actions + Cloudflare Pages auto-deploy** | Pages build alone | Actions as required status check with validation |

### Explicit rejections
- **Contentlayer** — unmaintained since mid-2024.
- **Idyll / Tangle.js** — unmaintained; reimplement their binding pattern with `useState`+context.
- **Distill.pub template** — on hiatus; cherry-pick typography only.
- **Disqus** — ads/trackers, privacy hostile.
- **Giscus** — requires every commenter to have a GitHub account; violates "anonymous by default".
- **Remark42** — great off-the-shelf fit for the comment requirement but we are building a Worker backend anyway, so unifying makes more sense.
- **Next.js / Docusaurus / Nextra** — heavier than necessary; would replace the existing app shell.
- **TinaCMS / Decap** — MDX support rough for custom JSX; unnecessary with LLM authoring.

---

## 3. Repository layout

```
personal_page/
  content/
    posts/
      2026-04-gptq-flipping-range/
        index.mdx
        images/
          cover.png
    drafts/                                # gitignored scratch (optional)
  src/
    App.tsx                                # existing sections + new <BlogRoutes/>
    routes/
      blog/
        index.tsx                          # /blog — post list
        $slug.tsx                          # /blog/:slug — post detail
    components/
      mdx/
        registry.ts                        # central block registry (Zod + Component)
        blocks/
          GPTQViz.tsx
          LatencyPlayground.tsx
          Quiz.tsx
          LoopedAnimation.tsx
          Figure.tsx
          Callout.tsx
        layout/
          PostLayout.tsx
          Comments.tsx
      ...existing sections unchanged
    schemas/
      post.ts                              # PostFrontmatter
      blocks.ts                            # per-block Zod schemas + discriminated union
      comment.ts
    lib/
      content/
        getPost.ts                         # dual-source reader (static + worker)
        listPosts.ts
      api.ts                               # typed fetchers for /api/*
      mdx/
        validate.ts                        # AST walker + Zod + literal-prop check
        fixtures.ts                        # fixture registry for Playwright/Ladle
    index.css                              # existing + KaTeX + Shiki themes
  vite.config.ts                           # updated with MDX chain
  scripts/
    validate-posts.ts                      # pre-commit + CI gate
    generate-registry-docs.ts              # emits registry-catalog.json for LLMs
  worker/
    wrangler.toml
    package.json
    src/
      index.ts                             # Hono app entry
      routes/
        posts.ts
        comments.ts
        admin.ts
        me.ts
      middleware/
        access.ts                          # verifies Cf-Access-Jwt-Assertion
        turnstile.ts
        ratelimit.ts
        moderation.ts
      db/
        schema.sql
        migrations/
      lib/
        r2.ts
        ulid.ts
        markdown.ts                        # safe md -> html for comments
    test/
  packages/
    shared/                                # importable by src/ AND worker/
      src/
        schemas/                           # the exact same Zod schemas both use
  .claude/
    mcp/
      blog-publisher/
        package.json
        src/
          index.ts                         # MCP server exposing blog tools
  .mcp.json                                # registers github-mcp + blog-publisher
  .github/
    workflows/
      validate.yml                         # PR: validate + test + visual regression
      deploy-worker.yml                    # main: wrangler deploy
  tests/
    visual.spec.ts
    __screenshots__/
  CLAUDE.md                                # repo-level LLM authoring rules
  BLOG_V2_PLAN.md                          # this file
```

The `packages/shared/` folder is a lightweight workspace package so Zod schemas live exactly once and are imported by both the Vite app and the Worker. Use pnpm workspaces (already on pnpm).

---

## 4. Frontend: Vite + MDX + prerender

### 4.1 Dependencies

```
pnpm add @mdx-js/rollup @mdx-js/react \
  remark-frontmatter remark-mdx-frontmatter remark-gfm remark-math \
  rehype-katex @shikijs/rehype shiki \
  zod \
  react-router \
  @tailwindcss/typography katex
# Phase 3+:
# pnpm add @visx/scale @visx/shape @visx/axis @visx/group d3-array @rive-app/react-canvas
# Phase 4:
# pnpm add vite-react-ssg
```

### 4.2 `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeShiki from '@shikijs/rehype'
import path from 'node:path'

export default defineConfig({
  plugins: [
    mdx({
      providerImportSource: '@mdx-js/react',
      remarkPlugins: [
        remarkFrontmatter,
        [remarkMdxFrontmatter, { name: 'frontmatter' }],
        remarkGfm,
        remarkMath,
      ],
      rehypePlugins: [
        rehypeKatex,
        [rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' } }],
      ],
    }),
    react(),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

**Critical**: `mdx()` must precede `react()`. Otherwise JSX inside `.mdx` is left untransformed and throws at runtime.

### 4.3 Content loader via `import.meta.glob`

No build step for content. `@mdx-js/rollup` compiles `.mdx` imports into real ES modules that export a default React component plus a named `frontmatter` export (via `remark-mdx-frontmatter`). Vite's `import.meta.glob` builds the index at module load:

```ts
// src/lib/content/posts.ts
import { z } from 'zod'
import { PostFrontmatter, type Post } from '@/schemas/post'

type MDXModule = {
  default: React.ComponentType
  frontmatter: Record<string, unknown>
}

const modules = import.meta.glob<MDXModule>('/content/posts/**/index.mdx', {
  eager: true,
})

function toPost(path: string, m: MDXModule): Post {
  const parsed = PostFrontmatter.parse(m.frontmatter)
  return { ...parsed, Body: m.default, sourcePath: path }
}

const allPosts: Post[] = Object.entries(modules).map(([p, m]) => toPost(p, m))
const bySlug = new Map(allPosts.map((p) => [p.slug, p]))

export function listPosts(opts: { includeDrafts?: boolean } = {}): Post[] {
  return allPosts
    .filter((p) => opts.includeDrafts || p.status === 'published')
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
}

export function getPost(slug: string): Post | undefined {
  return bySlug.get(slug)
}
```

Validation runs on import — a broken frontmatter throws at module load, which shows up as a loud build error. Phase 2 adds `scripts/validate-posts.ts` for per-file CI output + JSX-prop validation.

### 4.4 Worker draft fallback (Phase 5+)

The git-resolved post is always the canonical source. When the Worker backend exists (Phase 5), a draft-preview path is added:

```ts
// Phase 5 extension of getPost
export async function getPost(slug: string): Promise<Post | undefined> {
  const fromGit = bySlug.get(slug)
  if (fromGit && fromGit.status === 'published') return fromGit
  // fallback for drafts/previews — only triggered when an API base is configured
  const api = import.meta.env.VITE_API_BASE
  if (!api) return fromGit
  const r = await fetch(`${api}/api/posts/${encodeURIComponent(slug)}`)
  return r.ok ? ((await r.json()) as Post) : fromGit
}
```

Worker-served drafts set `<meta name="robots" content="noindex">` in the post layout so search engines never index them. "Publish" means promoting the draft to a git PR via `promote_draft_to_repo`; the git-merged, file-based version is what gets prerendered and indexed.

### 4.5 Routes

```tsx
// src/routes/blog/$slug.tsx
import { useLoaderData } from 'react-router'
import { MDXProvider } from '@mdx-js/react'
import { PostLayout } from '@/components/mdx/layout/PostLayout'
import { mdxComponents } from '@/components/mdx/registry'
import type { Post } from '@/schemas/post'

export async function loader({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  if (!post) throw new Response('Not found', { status: 404 })
  return post
}

export default function BlogPost() {
  const post = useLoaderData() as Post
  const Body = post.body
  return (
    <MDXProvider components={mdxComponents}>
      <PostLayout meta={post}>
        <Body />
      </PostLayout>
    </MDXProvider>
  )
}
```

### 4.6 Prerendering for SEO

`vite-react-ssg` enumerates slugs from `listPosts()` at build. Every `status === 'published'` file-based post gets a static HTML file with all meta tags, full body, and JSON-LD. Worker-only drafts are not prerendered and carry `noindex` (§11).

### 4.7 Typography + dark mode

Enable `@tailwindcss/typography`. Wrap post body in `<article className="prose prose-slate dark:prose-invert max-w-none">…</article>`. Load KaTeX CSS globally once in `src/index.css`:

```css
@import 'katex/dist/katex.min.css';
```

---

## 5. Interactive block registry

### 5.1 Why a single registry

One object, read by five consumers:

1. **`MDXProvider`** at runtime — maps tag names to React components.
2. **Validator** at build time — Zod-parses every JSX usage.
3. **`generate-registry-docs.ts`** — emits `registry-catalog.json` to prime LLM prompts.
4. **Ladle** dev gallery — one story per fixture.
5. **Playwright** — one visual snapshot per fixture.

### 5.2 Schemas

`src/schemas/blocks.ts`:

```ts
import { z } from 'zod'

export const GPTQVizProps = z.object({
  groupSize: z.number().int().min(1).max(1024).default(128),
  clipRange: z.tuple([z.number(), z.number()]).default([-4, 4]),
  showHistogram: z.boolean().default(true),
  seed: z.number().int().optional(),
}).strict()
export type GPTQVizProps = z.infer<typeof GPTQVizProps>

export const LatencyPlaygroundProps = z.object({
  defaults: z.object({
    throughputTokPerS: z.number().positive(),
    refillMs: z.number().nonnegative(),
    rttMs: z.number().nonnegative(),
    contextTokens: z.number().int().nonnegative().default(2048),
  }),
  scenarios: z
    .array(z.object({ label: z.string(), values: z.record(z.string(), z.number()) }))
    .default([]),
}).strict()
export type LatencyPlaygroundProps = z.infer<typeof LatencyPlaygroundProps>

export const QuizProps = z.object({
  questions: z
    .array(
      z.object({
        q: z.string().min(1),
        options: z.array(z.string().min(1)).min(2).max(6),
        answer: z.number().int().nonnegative(),
        explanation: z.string().optional(),
      })
    )
    .min(1),
}).strict()
export type QuizProps = z.infer<typeof QuizProps>

export const LoopedAnimationProps = z.object({
  src: z.string().regex(/\.(riv|lottie|json)$/),
  autoplay: z.boolean().default(true),
  stateMachine: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  className: z.string().optional(),
}).strict()
export type LoopedAnimationProps = z.infer<typeof LoopedAnimationProps>

export const FigureProps = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
}).strict()
export type FigureProps = z.infer<typeof FigureProps>

export const CalloutProps = z.object({
  tone: z.enum(['info', 'warn', 'aside', 'gotcha']).default('info'),
  title: z.string().optional(),
}).strict()
```

All block schemas are `.strict()` so an unknown prop fails validation. All props are **purely literal** (no schemas requiring callbacks or React nodes as props — any rich content is children in MDX).

### 5.3 Registry

`src/components/mdx/registry.ts`:

```ts
import { GPTQViz } from './blocks/GPTQViz'
import { LatencyPlayground } from './blocks/LatencyPlayground'
import { Quiz } from './blocks/Quiz'
import { LoopedAnimation } from './blocks/LoopedAnimation'
import { Figure } from './blocks/Figure'
import { Callout } from './blocks/Callout'
import * as B from '@/schemas/blocks'

type Entry<S extends z.ZodTypeAny> = {
  schema: S
  Component: React.ComponentType<z.infer<S>>
  fixtures: { name: string; props: z.infer<S> }[]
  docs: string // used in the LLM catalog
}

export const blockRegistry = {
  GPTQViz: {
    schema: B.GPTQVizProps,
    Component: GPTQViz,
    fixtures: [{ name: 'defaults', props: { groupSize: 128, clipRange: [-4, 4], showHistogram: true } }],
    docs: 'Interactive GPTQ group-wise quantization explorer...',
  },
  LatencyPlayground: { /* ... */ },
  Quiz: { /* ... */ },
  LoopedAnimation: { /* ... */ },
  Figure: { /* ... */ },
  Callout: { /* ... */ },
} as const satisfies Record<string, Entry<any>>

export type BlockName = keyof typeof blockRegistry

export const mdxComponents = Object.fromEntries(
  Object.entries(blockRegistry).map(([k, v]) => [k, v.Component])
) as Record<BlockName, React.ComponentType<any>>
```

### 5.4 Authoring rule: literal props only

Only JSON-literal attribute values are allowed on registry blocks inside MDX:

```mdx
<!-- ok -->
<GPTQViz groupSize={64} clipRange={[-3, 3]} showHistogram={true} />

<!-- rejected by validator -->
<GPTQViz groupSize={gs} />   {/* expression reference */}
<GPTQViz {...spread} />      {/* spread */}
```

This is the cost of static verifiability. Since interactive behavior lives inside the component itself, this constraint doesn't reduce expressiveness — it eliminates an entire class of LLM authoring failures and makes the schema load-bearing at build time.

### 5.5 TypeScript reinforces Zod

Because each `Component: React.ComponentType<z.infer<S>>` is typed from its schema, and MDX's TypeScript resolves tags through `MDXProvider`'s component map, `tsc -b` catches most prop typos even before the custom validator runs. The validator remains the authority for literal-prop checks and exact-strict policy; TypeScript is the first-line guard during development.

---

## 6. Pre-publish validation pipeline

### 6.1 `scripts/validate-posts.ts`

Runs three checks per `.mdx`:

1. **Frontmatter**: `PostFrontmatter.safeParse(matter.data)`.
2. **MDX compile**: `await compile(content)` — parse errors caught early.
3. **JSX walk**: for every `mdxJsxFlowElement` / `mdxJsxTextElement` whose name is in `blockRegistry`, coerce attributes to a plain object (reject if any `mdxJsxExpressionAttribute` or non-literal value), then run `registry[name].schema.parse(props)`.

Errors are printed with file, line, and column. Exit non-zero on first PR ensures precise CI failure messages.

```ts
import { compile, createProcessor } from '@mdx-js/mdx'
import { visit } from 'unist-util-visit'
import matter from 'gray-matter'
import fg from 'fast-glob'
import fs from 'node:fs/promises'
import path from 'node:path'
import { PostFrontmatter } from '@/schemas/post'
import { blockRegistry, type BlockName } from '@/components/mdx/registry'

type ValidationError = { file: string; line?: number; message: string }
const errors: ValidationError[] = []

const files = await fg('content/posts/**/index.mdx')

for (const file of files) {
  const raw = await fs.readFile(file, 'utf8')
  const { data, content } = matter(raw)

  const fm = PostFrontmatter.safeParse(data)
  if (!fm.success) errors.push({ file, message: `frontmatter: ${fm.error.message}` })

  try {
    const processor = createProcessor({ /* same remark chain */ })
    const tree = processor.parse(content)
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any) => {
      const name = node.name as string | null
      if (!name || !(name in blockRegistry)) return
      const props = readLiteralProps(node.attributes, file, node.position?.start.line)
      const entry = blockRegistry[name as BlockName]
      const res = entry.schema.safeParse(props)
      if (!res.success) errors.push({ file, line: node.position?.start.line, message: `<${name}>: ${format(res.error)}` })
    })
    await compile(content) // final dry-run
  } catch (e: any) {
    errors.push({ file, message: String(e.message ?? e) })
  }

  // images referenced in frontmatter and <Figure> must exist
  const dir = path.dirname(file)
  await verifyImagesResolve(dir, raw, errors)
}

if (errors.length) {
  for (const e of errors) console.error(`${e.file}${e.line ? ':' + e.line : ''} — ${e.message}`)
  process.exit(1)
}
```

`readLiteralProps` rejects anything non-literal, including JSX expression containers referencing identifiers, function calls, or spreads.

### 6.2 Link check

CI runs `lychee --accept 200,429 --cache content/ README.md` after validation. False-positive rate-limited hosts are accepted via 429.

### 6.3 Visual regression

- `tests/visual.spec.ts` iterates every registry fixture, mounts it on a Ladle route, and `await expect(page).toHaveScreenshot(`${block}-${fixture}.png`)`.
- Baselines are generated and committed from `ubuntu-latest`.
- Threshold: `maxDiffPixelRatio: 0.001`.
- Skipped by default on developer machines (cross-OS flakiness); run with `pnpm test:visual` to debug locally.

### 6.4 Pre-commit

`husky` + `lint-staged`:
- Staged `*.mdx` → `node scripts/validate-posts.ts --only-staged`.
- Staged `*.ts(x)` → `eslint --fix`, `prettier --write`, `tsc --noEmit` (incremental).

Playwright runs in CI only.

### 6.5 Repair-loop output

Error lines are formatted as `path:line — <Block>: prop "foo" expected positive number, got -2`. This exact format is easy for Claude to parse in a repair loop (see §7.3).

---

## 7. LLM-authored content pipeline

### 7.1 The two authoring modes

**Mode A — Git PR (default, unauthenticated):**

```
Claude Code
  ├── loads .claude/mcp/blog-publisher/  (our wrapper MCP)
  ├── loads official github-mcp-server
  └── loads registry-catalog.json into context
         │
         ▼
1. Claude generates frontmatter via structured output (PostFrontmatter Zod)
2. Claude writes content/posts/<slug>/index.mdx locally (fs)
3. Claude calls validate_post(slug) → MCP runs validate-posts.ts on that file
4. On errors: Claude re-prompts itself with the exact error output (repair loop)
5. On success: Claude calls publish_post_git(slug, branch)
         │
         ▼
blog-publisher-mcp
  ├── re-validates
  ├── calls github-mcp create_branch
  ├── calls github-mcp create_or_update_file for index.mdx + images/*
  └── calls github-mcp create_pull_request
         │
         ▼
GitHub PR opened
  → Cloudflare Pages preview deploy (auto)
  → GitHub Actions validate.yml runs (required status check)
  → Human reviews preview URL, interactive components live
  → Merge → Pages prod deploy
```

**Mode B — Worker POST (authenticated, drafts + live edits):**

```
Same authoring. At step 5, Claude calls publish_post_worker(slug, mdx, draft=true).

blog-publisher-mcp
  └── POSTs to https://api-admin.yoursite.com/api/posts
          with Cf-Access-Authenticated-User-Email verified header
          (Claude has browser-logged-in session forwarded, or an
          Access service token in .mcp.env)
         │
         ▼
Worker
  ├── validates PostFrontmatter + MDX compile
  ├── writes metadata row to D1
  ├── writes MDX blob to R2 (posts/<slug>.mdx)
  └── returns { status: 'ok', slug, draft: true }

Site renders the draft via getPost() fallback when
?draft=<short-token> is present or the user is Access-authed.

Later: promote_draft_to_repo(slug) — Worker endpoint uses a
GitHub App installation token to open a PR containing the R2 blob
as a file. Closes the loop between the two modes.
```

### 7.2 Custom MCP: `blog-publisher-mcp`

Located at `.claude/mcp/blog-publisher/` and wired into `.mcp.json`. One small Node MCP server. Tools:

| Tool | Inputs | Behavior |
| --- | --- | --- |
| `list_registry` | — | Returns `registry-catalog.json` (block names, Zod JSON Schema, docs, fixture examples) |
| `validate_post` | `{ path }` | Runs `validate-posts.ts` on that file; returns structured errors |
| `new_post_skeleton` | `{ title, slug, category }` | Writes a bare `index.mdx` with valid frontmatter |
| `publish_post_git` | `{ slug, branch }` | Re-validates; calls GitHub MCP to create branch + file + PR |
| `publish_post_worker` | `{ slug, mdx, draft }` | POSTs to Worker admin endpoint; returns deploy URL |
| `promote_draft_to_repo` | `{ slug }` | Calls Worker endpoint which uses GitHub App to PR |
| `list_drafts` | — | Fetches D1 drafts via Worker |

Registering:

```jsonc
// .mcp.json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run","-i","--rm","-e","GITHUB_PERSONAL_ACCESS_TOKEN","ghcr.io/github/github-mcp-server"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_TOKEN}" }
    },
    "blog-publisher": {
      "command": "node",
      "args": [".claude/mcp/blog-publisher/dist/index.js"],
      "env": { "WORKER_BASE": "https://api-admin.yoursite.com", "CF_ACCESS_SERVICE_TOKEN": "${env:CF_ACCESS_SERVICE_TOKEN}" }
    }
  }
}
```

Never commit tokens; always `${env:...}`. Keep service token in `~/.zshrc`.

### 7.3 Repair loop pattern

In the system prompt via `CLAUDE.md`:

```
When writing a blog post:
1. Call list_registry first. Only use components listed there.
2. All props must be literal (no {variables}, no spreads).
3. After writing the file, call validate_post({ path }). If errors return, fix them and re-validate. Do not publish until validate_post returns ok.
4. When ok, call publish_post_git({ slug, branch }).

Error format: "path:line — <Block>: <description>". Treat each line as one required fix. Typical fixes:
- "prop X expected Y, got Z" → change literal value
- "unknown prop X" → remove it; all schemas are strict
- "non-literal prop" → inline the value or move logic inside the component
```

### 7.4 `CLAUDE.md` at repo root

Contains:
- Summary of the stack.
- Authoring rules above.
- Path conventions (`content/posts/<YYYY-MM-<slug>>/index.mdx`, images in sibling `images/`).
- Style conventions (concise, calibrated; no marketing voice).
- Commit and PR conventions.
- How to run `pnpm dev`, `pnpm validate`, `pnpm build`, `pnpm test:visual`.

### 7.5 Structured-output tips

- Bind frontmatter generation to `PostFrontmatter` via JSON Schema. Flatten nested objects; Claude's structured outputs currently struggle with deep recursion.
- Validate block props **after** generation with a post-parse pass rather than in a single mega-schema — cleaner and more robust.

---

## 8. Backend: Cloudflare Worker + D1 + R2

### 8.1 Framework

**Hono** on Workers — small, typed, Zod-friendly.

```
pnpm --filter worker add hono @cloudflare/workers-types zod
pnpm --filter worker add -D wrangler typescript vitest @cloudflare/vitest-pool-workers
```

### 8.2 `wrangler.toml`

```toml
name = "yoursite-api"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "yoursite-db"
database_id = "…"

[[r2_buckets]]
binding = "BLOB"
bucket_name = "personal-blog"

[[kv_namespaces]]
binding = "KV"
id = "…"

[[unsafe.bindings]]
name = "RL"
type = "ratelimit"
namespace_id = "100"
simple = { limit = 10, period = 60 }

[vars]
TURNSTILE_SITEKEY = "…"
# secrets: TURNSTILE_SECRET, CLAUDE_API_KEY (for moderation), ACCESS_AUD, GITHUB_APP_* — set via `wrangler secret put`

[env.preview]
# separate D1 database id, separate R2 bucket suffix, separate Access app
```

### 8.3 D1 schema

`worker/src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS posts (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  tags_json     TEXT NOT NULL DEFAULT '[]',
  category      TEXT,
  status        TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  r2_key        TEXT NOT NULL,
  published_at  INTEGER,
  updated_at    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS posts_by_status_time ON posts(status, published_at);

CREATE TABLE IF NOT EXISTS comments (
  id                TEXT PRIMARY KEY,            -- ulid
  post_slug         TEXT NOT NULL,
  parent_id         TEXT,
  author_name       TEXT NOT NULL,
  author_token_hash TEXT,                        -- for own-edit window
  is_author         INTEGER NOT NULL DEFAULT 0,  -- 1 = owner (Access-authed)
  body_md           TEXT NOT NULL,
  body_html         TEXT NOT NULL,               -- pre-rendered safe HTML
  created_at        INTEGER NOT NULL,
  hidden_at         INTEGER,
  flags             INTEGER NOT NULL DEFAULT 0,
  ip_hash           TEXT NOT NULL,
  ua_hash           TEXT,
  FOREIGN KEY (post_slug) REFERENCES posts(slug)
);

CREATE INDEX IF NOT EXISTS comments_by_slug_time ON comments(post_slug, created_at);
CREATE INDEX IF NOT EXISTS comments_hidden ON comments(hidden_at);

CREATE TABLE IF NOT EXISTS bans (
  ip_hash    TEXT PRIMARY KEY,
  reason     TEXT,
  created_at INTEGER NOT NULL
);
```

Migrations via `wrangler d1 migrations apply`.

### 8.4 Routes

```
GET   /api/posts                 public   list published (D1 join R2 for metadata only)
GET   /api/posts/:slug           public   metadata + MDX body from R2
POST  /api/posts                 admin    create/update (idempotent on slug)
POST  /api/posts/:slug/promote   admin    open PR from D1 draft via GitHub App
POST  /api/posts/:slug/publish   admin    flip status to 'published'
DELETE /api/posts/:slug          admin

GET   /api/comments/:slug        public   visible comments for slug, flat+1
POST  /api/comments/:slug        public   anonymous comment (Turnstile + RL + moderation)
POST  /api/comments/:slug/reply  admin    owner reply (is_author=1)
PATCH /api/comments/:id          own-token or admin (edit window 10 min)
POST  /api/comments/:id/hide     admin
DELETE /api/comments/:id         admin
POST  /api/comments/:id/flag     public   increment flag counter

GET   /api/me                    public   returns { isAuthor: boolean } from Access JWT
```

### 8.5 Auth — Cloudflare Access

- Create a Cloudflare Access **self-hosted app** for `api-admin.yoursite.com`.
- Identity provider: **GitHub**; policy: `identity.email == "vilhelm.toivonen@vibemetrics.com"`.
- Admin subdomain sits in front of the `admin` sub-app; public paths live on `api.yoursite.com` (no Access).
- Middleware verifies `Cf-Access-Jwt-Assertion` against the app's public keys; stores the decoded identity in `c.var.owner`.

```ts
// middleware/access.ts
export const accessMiddleware = () => async (c, next) => {
  const jwt = c.req.header('Cf-Access-Jwt-Assertion')
  if (!jwt) return c.json({ error: 'unauthenticated' }, 401)
  const payload = await verifyAccessJwt(jwt, c.env.ACCESS_AUD, c.env.ACCESS_ISSUER)
  if (payload.email !== c.env.OWNER_EMAIL) return c.json({ error: 'forbidden' }, 403)
  c.set('owner', payload)
  await next()
}
```

Two Workers (public + admin) share code via a `createApp(config)` pattern; wrangler deploys both.

### 8.6 Spam defense layering

1. **Turnstile** — widget on the comment form, token sent as `cf-turnstile-response`; Worker calls Cloudflare's `siteverify` endpoint server-side. Reject on fail.
2. **Rate limit** — CF Rate Limit binding, composite key `sha256(ipHash + ua + slug)`. Thresholds: 1 comment / 30s, 10 / hr, 30 / day.
3. **Honeypot field** (`website` in the form, CSS-hidden). Any nonempty → silent reject.
4. **LLM moderation**: Claude Haiku classifier with 5-line prompt outputs `{ok, spam, abuse}`. Budget cap $0.50/mo by invoking only for non-empty, post-rate-limit, non-honeypot submissions. `ok` → insert. `spam` → silent drop. `abuse` → insert with `hidden_at = now` for you to review.
5. **Content rules** — max 2 links per comment, reject domains on a small blocklist, strip HTML, render Markdown through `markdown-it` with link whitelist.
6. **IP ban table** — admin UI lets you ban by `ip_hash`.

All checks are short-circuiting; Turnstile + rate limit handle 99% of drive-bys.

### 8.7 Owner "Author" reply flow

- Owner opens the post page. `<Comments>` component calls `GET /api/me` (with cookies). The admin Worker is gated by Access, so an unauthenticated call returns `{ isAuthor: false }` (the Access login page is surfaced via `?redirect=` only when the user opts to log in).
- If `isAuthor`, the comment form drops Turnstile, shows a distinct "Reply as Author" button, and sends to `POST /api/comments/:slug/reply`. Response includes the comment with `is_author=1` so the component renders the author styling immediately.

### 8.8 Comment rendering

- Markdown subset: bold, italic, code, links, paragraphs. Block anything else.
- HTML is pre-rendered server-side into `body_html` at insert time (through a hardened `markdown-it` + sanitizer) so the client does zero parsing.
- Author styling:
  - Bold name + accent color.
  - `Author` pill on the right of the name.
  - Subtle left border on the comment row.
- Nesting: flat + 1 level. Deeper replies flatten onto the parent.

### 8.9 R2 layout

```
r2://personal-blog/
  posts/<slug>.mdx             # MDX body when a post is Worker-authored
  images/<slug>/<filename>     # images uploaded by the owner
  og/<slug>.png                # cached OG images
```

Public read via custom domain `cdn.yoursite.com`. Writes only from the admin Worker with `BLOB` binding.

---

## 9. Comments frontend component

`src/components/mdx/layout/Comments.tsx`:

- Rendered at the bottom of `PostLayout` by default (toggleable per-post via frontmatter).
- Boots with `GET /api/comments/:slug` + `GET /api/me` in parallel.
- Form state: name (default "Anonymous"), body (Markdown), Turnstile widget.
- On submit, POSTs JSON; on 200, optimistically appends the comment and stores the server-returned edit token in a `SameSite=Lax; Secure; HttpOnly=false` cookie keyed to the comment id (so the editor can use it for 10 minutes without a server session).
- Renders nested (+1) replies, author styling, relative timestamps.
- Accessibility: proper heading levels, ARIA live region for new comments, keyboard-accessible Turnstile, dark-mode aware.

---

## 10. Deployment topology

```
                         yoursite.com
                              │
                              ▼
                   ┌───────────────────────┐
                   │ Cloudflare Pages       │
                   │  - vite-react-ssg      │
                   │  - static /blog/*      │
                   │  - SPA fallback        │
                   └─────────┬─────────────┘
                              │ fetch /api/...
              ┌──────────────┴─────────────┐
              ▼                             ▼
  ┌─────────────────────┐         ┌──────────────────────┐
  │ api.yoursite.com    │         │ api-admin.yoursite.com│
  │ public Worker       │         │ admin Worker (Access) │
  │  - posts GET        │         │  - posts POST/PATCH   │
  │  - comments GET     │         │  - comments reply/mod │
  │  - comments POST    │         │  - promote-to-repo    │
  │  - me               │         │                       │
  └──────────┬──────────┘         └───────────┬───────────┘
             │                                │
             └──────────┬──────────┬──────────┘
                        ▼          ▼
                  ┌──────────┐ ┌──────────┐
                  │ D1       │ │ R2       │
                  │ (posts,  │ │ (mdx,    │
                  │ comments)│ │ images)  │
                  └──────────┘ └──────────┘

Auth:
  public Worker  — no Access
  admin Worker   — Cloudflare Access, GitHub OAuth, email allowlist (owner only)

cdn.yoursite.com  → R2 public bucket (images, og images)
```

### 10.1 CI workflows

`.github/workflows/validate.yml` (required status check on PRs):

```yaml
name: validate
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm velite build
      - run: pnpm tsc -b
      - run: pnpm validate-posts
      - run: pnpm test
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:visual
      - uses: lycheeverse/lychee-action@v2
        with: { args: --accept 200,429 --cache content/ README.md }
```

`.github/workflows/deploy-worker.yml` (on `main` affecting `worker/**`):

```yaml
name: deploy-worker
on:
  push:
    branches: [main]
    paths: ['worker/**', 'packages/shared/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter worker test
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          workingDirectory: worker
          command: deploy --env=production
```

Cloudflare Pages auto-deploys the Vite site on push. Every PR gets a preview URL; `VITE_API_BASE` in the preview environment points to a **preview Worker** (env=preview) with its own D1 copy so you never touch production data from a preview.

### 10.2 Promotion

Hotfixes: direct push (allowed on `main`). Everything else via PR. Preview deploy URL posted automatically by Cloudflare Pages in the PR conversation — this is where you verify interactive components.

---

## 11. SEO, performance, a11y

### 11.1 The git-vs-Worker contract (decided)

There are two stores for a post, with a crisp separation of roles:

- **Git repo (`content/posts/**/*.mdx`)** — the **canonical, SEO-indexed** source of truth. Every `status: 'published'` file is **prerendered** to static HTML at build by `vite-react-ssg` and served directly from Cloudflare Pages. Full body text in the initial response (not a JS-hydrated skeleton). Meta tags, OG tags, canonical URL, and JSON-LD `Article` are baked into the HTML at build time.
- **Cloudflare Worker + D1 + R2** — a **drafts / staging / preview** store. Worker-served posts always emit `<meta name="robots" content="noindex, nofollow">` and set `X-Robots-Tag: noindex` response headers. Social crawlers therefore will not index or card-preview a Worker-only post.

"Publishing" a post = promoting it from the Worker store to the git repo via the `promote_draft_to_repo` MCP tool (opens a PR with the MDX file). Merge → Pages build → prerender → indexable. Authoring directly in the repo (the default LLM flow) skips the Worker store entirely.

Consequence: **every post that is ever user-visible to the public internet is prerendered and SEO-complete**. There is no "backend-only published post" state. This is the Option (1) decision we made.

### 11.2 What prerender gets you per published post

- Full `<title>`, `<meta name="description">`, canonical URL.
- Open Graph: `og:title`, `og:description`, `og:type=article`, `og:image`, `og:url`, `article:published_time`, `article:author`, `article:tag` per tag.
- Twitter card: `summary_large_image` with appropriate dimensions.
- JSON-LD `Article` schema with `headline`, `datePublished`, `dateModified`, `author`, `image`, `keywords`.
- `<h1>` = post title; semantic heading hierarchy from MDX.
- All body text + all image URLs in the initial HTML.
- Clean URLs `/blog/<slug>` (no hash, no query), canonical set.
- `sitemap.xml` + `rss.xml` generated at build from `listPosts()`.
- `robots.txt` allows everything except `/admin` and Worker preview subdomains.

### 11.3 Performance + a11y

- **Code splitting**: each block is lazy-loaded via `React.lazy` so a 300-word post doesn't ship visx.
- **Image handling**: Phase 0–3 images live beside the post at `content/posts/<slug>/images/`; Vite's static asset pipeline hashes and serves them. When the Worker backend exists, Worker-authored drafts serve images from R2 via `cdn.yoursite.com`. Promoting a draft copies images back into the repo.
- **Hydration safety**: interactive blocks must be deterministic at SSR (no `Math.random()` / `Date.now()` during render; use `useEffect` for non-deterministic init). The validator can flag this in Phase 2.
- **Accessibility**: `@tailwindcss/typography` baseline; every `<Figure>` requires `alt`; `<Quiz>` uses native `<fieldset>`/`<legend>`; `<LoopedAnimation>` respects `prefers-reduced-motion`.
- **Core Web Vitals**: target ≥ 95 on all blog pages. Lighthouse CI runs in Phase 4 as a CI check.

---

## 12. Phased ship plan

Each phase ends with a concrete acceptance test. Budget is rough; pace yourself.

### Phase 0 — Scaffolding (0.5 day)
- [ ] Add deps: `@mdx-js/rollup`, `@mdx-js/react`, `remark-frontmatter`, `remark-mdx-frontmatter`, `remark-gfm`, `remark-math`, `rehype-katex`, `@shikijs/rehype`, `shiki`, `zod`, `react-router`, `@tailwindcss/typography`, `katex`.
- [ ] Add directories: `content/`, `src/routes/blog/`, `src/components/mdx/`, `src/schemas/`.
- [ ] Update `vite.config.ts` with the MDX plugin chain (`mdx()` must precede `react()`).
- [ ] Add `src/mdx.d.ts` with MDX module type declarations.
- [ ] Add Tailwind typography plugin; `@import 'katex/dist/katex.min.css'` in `src/index.css`.
- [ ] `src/schemas/post.ts` — Zod `PostFrontmatter` + derived `Post` type.
- [ ] `src/lib/content/posts.ts` — `import.meta.glob` index + `listPosts`/`getPost`.
- [ ] `src/components/mdx/layout/PostLayout.tsx` — wraps body in `prose`.
- [ ] `src/routes/blog/index.tsx` + `src/routes/blog/$slug.tsx`.
- [ ] `src/App.tsx` — React Router `createBrowserRouter` with `/`, `/blog`, `/blog/:slug`.
- [ ] `content/posts/hello-world/index.mdx` with frontmatter + plain body.
- [ ] `.gitignore` adds `content/drafts/`.
- **Acceptance**: `pnpm build` succeeds; `pnpm dev` serves `/blog/hello-world` with typography.

### Phase 1 — Registry + first real block (1 day)
- [ ] `schemas/blocks.ts` for `Figure`, `Callout`, `GPTQViz` (strict).
- [ ] Build `GPTQViz` using visx + d3-scale. Real online group-wise quant algorithm. Sliders via shadcn (add shadcn/ui slider primitive).
- [ ] `components/mdx/registry.ts` with those three blocks + fixtures + docs.
- [ ] `MDXProvider` in `PostLayout`.
- [ ] Convert the placeholder post to use `<GPTQViz/>` + a figure + a callout.
- **Acceptance**: `/blog/hello-world` shows a working interactive GPTQ viz.

### Phase 2 — Validation pipeline (1 day)
- [ ] `scripts/validate-posts.ts` (frontmatter + JSX walk + literal-prop + MDX compile).
- [ ] `scripts/generate-registry-docs.ts` → `registry-catalog.json`.
- [ ] Husky + lint-staged on staged `.mdx`.
- [ ] `.github/workflows/validate.yml` as required status check.
- [ ] Seed an intentionally-broken PR to confirm CI blocks merge.
- **Acceptance**: validator reports precise line+column for any schema violation; CI rejects broken post.

### Phase 3 — More blocks + visual regression (1.5 days)
- [ ] `LatencyPlayground` (visx), `Quiz`, `LoopedAnimation` (@rive-app/react-canvas).
- [ ] Typography, dark mode, mobile pass.
- [ ] Ladle with one story per fixture.
- [ ] Playwright `toHaveScreenshot` in CI. Commit `ubuntu-latest` baselines.
- [ ] Author a real first post covering GPTQ or latency, mixing all blocks.
- **Acceptance**: opening a PR that accidentally restyles a block causes a visual-diff failure.

### Phase 4 — Prerender + SEO (0.5 day)
- [ ] `vite-react-ssg` enumerating published slugs.
- [ ] Sitemap, RSS, JSON-LD, OG cover pipeline.
- [ ] Lighthouse CI budget: perf/seo/a11y ≥ 95 on sample post.
- [ ] Publish to Cloudflare Pages prod on merge.
- **Acceptance**: `curl -s https://yoursite.com/blog/<slug>` returns full HTML with OG tags.

### Phase 5 — Worker backend for posts (1.5 days)
- [ ] `worker/` workspace, Hono skeleton, `wrangler.toml`, D1 migrations.
- [ ] R2 bucket + `cdn.yoursite.com` custom domain.
- [ ] Public routes: `GET /api/posts`, `GET /api/posts/:slug` (D1 metadata + R2 MDX).
- [ ] Admin Worker on `api-admin.yoursite.com` behind Cloudflare Access (GitHub OAuth, email allowlist).
- [ ] Access JWT verify middleware.
- [ ] Admin routes: `POST /api/posts`, `POST /api/posts/:slug/publish`, `POST /api/posts/:slug/promote`.
- [ ] Shared Zod schemas in `packages/shared`.
- [ ] `getPost` fallback wired; preview env has `VITE_API_BASE` set.
- **Acceptance**: `curl` a draft to admin Worker; draft appears on the site behind `?draft=<token>` and is not prerendered.

### Phase 6 — Comments (1.5 days)
- [ ] D1 `comments` + `bans` tables with indexes.
- [ ] Public routes: `GET /api/comments/:slug`, `POST /api/comments/:slug` with Turnstile + rate limit + Haiku moderation + honeypot.
- [ ] Admin routes: `POST /api/comments/:slug/reply`, `PATCH /api/comments/:id`, `hide`, delete, ban.
- [ ] `GET /api/me` for author detection.
- [ ] `<Comments>` React component embedded in `PostLayout` with Author styling, edit window, flat+1 nesting.
- [ ] Lightweight admin UI page at `/admin` (auth-gated) listing all comments with hide/ban.
- **Acceptance**: anonymous comment posts through Turnstile; your authed reply shows Author pill + accent; spam sentence is silently dropped.

### Phase 7 — LLM authoring (1 day)
- [ ] `.claude/mcp/blog-publisher/` MCP server with: `list_registry`, `validate_post`, `new_post_skeleton`, `publish_post_git`, `publish_post_worker`, `promote_draft_to_repo`, `list_drafts`.
- [ ] Register in `.mcp.json` alongside the official GitHub MCP.
- [ ] `CLAUDE.md` with authoring rules + path conventions + repair-loop instructions.
- [ ] Generate first LLM-authored post end-to-end: Claude Code prompt → validated MDX → PR → preview deploy.
- **Acceptance**: single Claude Code prompt produces a valid PR; preview URL demonstrates working interactive components; validate.yml passes.

### Phase 8 — Polish (ongoing)
- [ ] Client-side search via Pagefind (free; builds at deploy; works on Cloudflare).
- [ ] Analytics via Cloudflare Web Analytics or Plausible self-hosted.
- [ ] Satori-based OG image generation.
- [ ] RSS prettification + full-content vs summary option.
- [ ] Admin dashboard improvements (bulk moderation, IP-hash ban, CSV export).
- [ ] Consider a "Talks" Velite collection.

Total: **≈ 7–8 focused engineering days**, realistically 3–4 calendar weeks part-time.

---

## 13. Gotchas / dead-ends

| Gotcha | Mitigation |
| --- | --- |
| MDX plugin must load before React in Vite | Enforced in `vite.config.ts`; documented above |
| `remark-mdx-frontmatter` export name ambiguity | Pinned to `{ name: 'frontmatter' }` |
| KaTeX CSS not included by default | `@import 'katex/dist/katex.min.css'` in `src/index.css` |
| Contentlayer unmaintained | Use Velite |
| Idyll / Tangle.js unmaintained | Reimplement reactive binding in 20 lines of React context |
| Distill.pub template on hiatus | Take typography ideas only |
| Playwright baselines OS-specific | Generate baselines on `ubuntu-latest`; document `pnpm test:visual:update` with `--update-snapshots` |
| Claude structured outputs can fail on deep schemas | Flatten frontmatter; validate block props as post-processing, not inside the JSON schema |
| Supabase RLS misconfigs leak data | Not using Supabase; Workers+D1 defaults closed |
| Turnstile site-verify required server-side | Middleware in comment POST; never trust client token |
| Cloudflare Rate Limit binding is per-Worker, not per-route | Compose key with method + path fragment |
| D1 write concurrency is limited | Fine for blog scale; watch if comments spike |
| R2 public read via custom domain | Set R2 public bucket + bind `cdn` subdomain; never expose Worker R2 credentials client-side |
| Claude MCP token must not be committed | Use `${env:GITHUB_TOKEN}` and `${env:CF_ACCESS_SERVICE_TOKEN}` |
| Preview deploys leaking drafts to public | Build-time filter by `status=='published'`, and preview uses separate D1 |
| Zod `.strict()` surprises LLM on trailing whitespace | Trim values in schema transforms |
| Lychee rate-limited false positives | `--accept 200,429 --cache` |
| Preview deploys can share R2 with prod if misconfigured | `env.preview` in `wrangler.toml` with separate R2 bucket name |
| GitHub App promote-to-repo needs installation token | Store App private key in Worker secret; swap for installation JWT at call time |

---

## 14. Decisions recap

| Decision | Choice |
| --- | --- |
| Stay on Vite + React | Yes |
| Content source | `content/posts/**/*.mdx` imported via `@mdx-js/rollup` + `import.meta.glob`; git repo is the canonical, SEO-indexed store; Cloudflare Worker is a drafts/preview store with `noindex` |
| Interactive authoring | MDX JSX blocks from a Zod registry, literal props only |
| Validation | Zod + MDX AST walker + TypeScript + Playwright snapshots |
| Hosting (static) | Cloudflare Pages |
| Backend | Cloudflare Worker (Hono) + D1 + R2 + KV |
| Owner auth | Cloudflare Access + GitHub OAuth, single-email policy |
| Comments | Custom Worker backend, anonymous + Author badge |
| Spam defense | Turnstile + Rate Limit + honeypot + Claude Haiku moderation |
| LLM authoring | Claude Code + official GitHub MCP + custom `blog-publisher-mcp` wrapper |
| Publish modes | Git PR (default) + Worker POST (authed) — same Zod schemas |
| SEO | Prerender via `vite-react-ssg` + sitemap + RSS + OG |
| Testing | Vitest + Playwright `toHaveScreenshot` + Ladle |

---

## 15. Open questions / deferred

- **Search** — Pagefind in Phase 8, possibly earlier if we hit 20+ posts.
- **Newsletter** — deferred; Buttondown integration is a small Worker endpoint when we want it.
- **Analytics** — Cloudflare Web Analytics (free, privacy-preserving) in Phase 8.
- **Talks collection** — second Velite collection in Phase 8.
- **i18n** — not planned.
- **Pseudonymous identity for returning commenters** — not planned for v2; edit window via signed cookie is enough.

---

## References

- Vite + MDX: https://mdxjs.com/packages/rollup/
- Velite: https://velite.js.org/guide/introduction
- Zod registries: https://zod.dev/metadata
- visx: https://github.com/airbnb/visx
- Rive vs Lottie: https://dev.to/uianimation/rive-vs-lottie-which-animation-tool-should-you-use-in-2025-p4m
- Cloudflare Pages previews: https://developers.cloudflare.com/pages/configuration/preview-deployments/
- Cloudflare D1 comments tutorial: https://developers.cloudflare.com/d1/tutorials/build-a-comments-api/
- Cloudflare Rate Limit binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- GitHub MCP: https://github.com/github/github-mcp-server
- Claude Code structured outputs: https://docs.claude.com/en/docs/build-with-claude/structured-outputs
- Playwright visual regression: https://playwright.dev/docs/test-snapshots
- Hono: https://hono.dev
- `vite-react-ssg`: https://github.com/antfu-collective/vite-ssg
- Lychee: https://github.com/lycheeverse/lychee-action
