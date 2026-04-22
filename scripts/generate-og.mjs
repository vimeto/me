// Generate per-post Open Graph PNG images using Satori (SVG) + resvg-js (PNG).
//
// Output: `dist/og/<slug>.png` plus a default `dist/og/default.png` used by
// routes that aren't per-post. Fonts are fetched from rsms/inter on first run
// and cached under `scripts/.fonts-cache/` (gitignored) so subsequent builds
// are offline-friendly.
//
// Invoked by `scripts/prerender.mjs`; not intended to be called standalone
// (depends on dist-ssr being built).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const fontsCache = path.join(__dirname, '.fonts-cache')

const FONT_SOURCES = [
  {
    name: 'Inter-Regular.ttf',
    // Pinned via fontsource CDN so CI is reproducible. Any jsdelivr mirror
    // works; the jsdelivr fontsource endpoint exposes plain TTFs (unlike the
    // npm @fontsource package, which ships only woff/woff2).
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.0.18/latin-400-normal.ttf',
    weight: 400,
  },
  {
    name: 'Inter-Bold.ttf',
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.0.18/latin-700-normal.ttf',
    weight: 700,
  },
]

async function loadFont(spec) {
  fs.mkdirSync(fontsCache, { recursive: true })
  const cachePath = path.join(fontsCache, spec.name)
  if (!fs.existsSync(cachePath)) {
    console.log(`  fetching ${spec.name} from GitHub…`)
    const res = await fetch(spec.url)
    if (!res.ok) {
      throw new Error(`font fetch failed for ${spec.url}: ${res.status}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(cachePath, buf)
  }
  return {
    name: 'Inter',
    data: fs.readFileSync(cachePath),
    weight: spec.weight,
    style: 'normal',
  }
}

// Satori only understands flexbox and a restricted subset of CSS, so every
// element below uses `display: flex` + direct style props (no classes).
function ogTree({ title, summary, kicker }) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '1200px',
        height: '630px',
        padding: '80px',
        background: '#0b1220',
        color: '#e5e7eb',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: '28px',
              color: '#60a5fa',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
            },
            children: kicker,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '76px',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  },
                  children: title,
                },
              },
              summary
                ? {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        fontSize: '32px',
                        color: '#94a3b8',
                        lineHeight: 1.35,
                      },
                      children: summary,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: '28px',
              color: '#94a3b8',
              fontWeight: 400,
            },
            children: 'vilhelmtoivonen.com',
          },
        },
      ],
    },
  }
}

// Rough 2-line clamp — Satori doesn't support -webkit-line-clamp, and unbounded
// summaries push the title off the card. Keeping summaries short also matches
// how OG previews render in most clients.
function clamp(str, max) {
  if (!str) return ''
  if (str.length <= max) return str
  return `${str.slice(0, max - 1).trimEnd()}…`
}

async function renderPng({ title, summary, kicker }, fonts) {
  const svg = await satori(ogTree({ title, summary, kicker }), {
    width: 1200,
    height: 630,
    fonts,
  })
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  return resvg.render().asPng()
}

async function main() {
  const serverEntry = await import(
    pathToFileURL(path.join(repoRoot, 'dist-ssr', 'entry-server.js')).href
  )
  const { listPosts, SITE } = serverEntry
  const distDir = path.join(repoRoot, 'dist')
  const outDir = path.join(distDir, 'og')
  fs.mkdirSync(outDir, { recursive: true })

  const fonts = await Promise.all(FONT_SOURCES.map(loadFont))

  // Default card — used for `/`, `/blog`, and any route without a bespoke
  // cover.
  const defaultPng = await renderPng(
    {
      title: SITE.name,
      summary: clamp(SITE.description, 180),
      kicker: 'Notes',
    },
    fonts
  )
  fs.writeFileSync(path.join(outDir, 'default.png'), defaultPng)
  console.log('  wrote dist/og/default.png')

  for (const post of listPosts()) {
    const png = await renderPng(
      {
        title: clamp(post.title, 90),
        summary: clamp(post.summary, 180),
        kicker: post.category ?? 'Writing',
      },
      fonts
    )
    fs.writeFileSync(path.join(outDir, `${post.slug}.png`), png)
    console.log(`  wrote dist/og/${post.slug}.png`)
  }
}

// Allow skipping OG generation for fast smoke builds (fonts may need to
// be fetched, which requires network on first run).
if (process.env.OG_SKIP === '1') {
  console.log('  OG_SKIP=1 — skipping OG image generation')
  process.exit(0)
}

main().catch((err) => {
  console.error('  OG generation failed:', err)
  process.exit(1)
})
