# vilhelmtoivonen.com

My personal site. Landing page with short sections on what I'm working on, plus a blog at `/blog` that hosts interactive technical writing (MDX + a Zod-validated component registry — see `BLOG_V2_PLAN.md` for the full story).

## Stack

React 19, TypeScript, Vite, Tailwind, Framer Motion. MDX via `@mdx-js/rollup` with remark-gfm / remark-math / KaTeX / Shiki. React Router 7.

## Develop

```
pnpm install
pnpm dev         # http://localhost:5173
pnpm build       # production build → dist/
pnpm lint
```

Blog posts live at `content/posts/<slug>/index.mdx`. Frontmatter is validated by a strict Zod schema on import; a broken post throws a loud error at module load.

## Deploy

No automation yet — `pnpm build` outputs `dist/` and I upload it. The target topology (Cloudflare Pages for the static site, Cloudflare Workers + D1 + R2 for drafts/comments) lives in `BLOG_V2_PLAN.md`.

## Layout

```
src/                React app (landing sections, blog routes, layouts)
content/posts/      MDX blog posts
BLOG_V2_PLAN.md     architecture + phased roadmap for the blog
CLAUDE.md           notes for Claude Code sessions
```
