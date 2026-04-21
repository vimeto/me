// Post-build prerender:
//   1. For each static path from entry-server.getAllStaticPaths(), render the
//      React tree to HTML, inject it into the client's index.html template,
//      inject per-page <head> meta, and write dist/<path>/index.html.
//   2. Generate dist/sitemap.xml and dist/feed.xml from the post list.
//
// Run after `vite build` (client) + `vite build --ssr` (server). See the
// `build` script in package.json.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const clientDir = path.join(repoRoot, 'dist')
const serverDir = path.join(repoRoot, 'dist-ssr')

const templatePath = path.join(clientDir, 'index.html')
const template = fs.readFileSync(templatePath, 'utf8')

const serverEntry = await import(pathToFileURL(path.join(serverDir, 'entry-server.js')).href)
const { render, getAllStaticPaths, getPageMeta, renderMetaTags, SITE, listPosts } =
  serverEntry

const paths = getAllStaticPaths()

function writeHtml(routePath, html) {
  const trimmed = routePath.replace(/^\/+|\/+$/g, '')
  if (trimmed === '') {
    fs.writeFileSync(path.join(clientDir, 'index.html'), html, 'utf8')
    return
  }
  // Emit both `<path>/index.html` (trailing-slash URLs, directory-index hosts)
  // and `<path>.html` (extensionless pretty URLs on hosts like CF Pages).
  const outDir = path.join(clientDir, trimmed)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8')
  const siblingDir = path.dirname(path.join(clientDir, trimmed))
  fs.mkdirSync(siblingDir, { recursive: true })
  fs.writeFileSync(`${path.join(clientDir, trimmed)}.html`, html, 'utf8')
}

for (const routePath of paths) {
  const appHtml = render(routePath)
  const meta = getPageMeta(routePath)
  const head = renderMetaTags(meta)
  const page = template
    .replace('<!--app-html-->', appHtml)
    .replace('<!--head-outlet-->', head)
  writeHtml(routePath, page)
  console.log(`  rendered ${routePath}`)
}

// Sitemap
function xmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const today = new Date().toISOString().slice(0, 10)
const sitemapUrls = paths.map((p) => {
  const loc = `${SITE.url.replace(/\/$/, '')}${p}`
  const isPost = /^\/blog\/[a-z0-9-]+$/.test(p)
  return {
    loc,
    lastmod: isPost
      ? (listPosts().find((post) => post.permalink === p)?.updatedAt ??
        listPosts().find((post) => post.permalink === p)?.publishedAt ??
        today)
      : today,
    changefreq: p === '/' ? 'monthly' : isPost ? 'yearly' : 'weekly',
    priority: p === '/' ? '1.0' : isPost ? '0.7' : '0.8',
  }
})
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) =>
      `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join('\n')}
</urlset>
`
fs.writeFileSync(path.join(clientDir, 'sitemap.xml'), sitemap, 'utf8')
console.log(`  generated sitemap.xml (${sitemapUrls.length} urls)`)

// RSS feed
const posts = listPosts()
const feedItems = posts
  .map((p) => {
    const link = `${SITE.url.replace(/\/$/, '')}${p.permalink}`
    const pubDate = new Date(`${p.publishedAt}T00:00:00Z`).toUTCString()
    return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEscape(p.summary)}</description>
${(p.tags ?? []).map((t) => `      <category>${xmlEscape(t)}</category>`).join('\n')}
    </item>`
  })
  .join('\n')

const lastBuild = new Date().toUTCString()
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${SITE.name} — Writing`)}</title>
    <link>${xmlEscape(SITE.url)}/blog</link>
    <atom:link href="${xmlEscape(SITE.url)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(SITE.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${feedItems}
  </channel>
</rss>
`
fs.writeFileSync(path.join(clientDir, 'feed.xml'), feed, 'utf8')
console.log(`  generated feed.xml (${posts.length} items)`)

// robots.txt (overwrite with consistent sitemap reference)
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE.url.replace(/\/$/, '')}/sitemap.xml
`
fs.writeFileSync(path.join(clientDir, 'robots.txt'), robots, 'utf8')
console.log('  wrote robots.txt')
