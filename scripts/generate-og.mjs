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

// Archival Precision palette — mirrors src/lib/tagColors.ts's family→series
// mapping, hand-flattened to hex since this script runs plain Node (no TS
// loader) and the mapping is small enough not to warrant one.
const FAMILY_COLORS = {
  'language-models': '#0D9488',
  'ml-systems': '#7C3AED',
  math: '#D97706',
  optimization: '#C02689',
  'lab-notes': '#65A30D',
}
const OCHRE = '#9A6418'

function familyColorOf(tags) {
  const first = tags?.[0]
  if (!first) return OCHRE
  const top = first.split('/', 1)[0]
  return FAMILY_COLORS[top] ?? OCHRE
}

// Shrink the title for long headlines so a three-line title never runs past
// the card's height; short titles keep the full 62px.
function titleFontSize(title) {
  const len = title.length
  if (len > 70) return 44
  if (len > 55) return 50
  if (len > 40) return 56
  return 62
}

// Satori only understands flexbox and a restricted subset of CSS, so every
// element below uses `display: flex` + direct style props (no classes). The
// summary node is the one exception — Satori's `lineClamp` only engages on
// `display: 'block'` text nodes, and it has no element children of its own.
function ogTree({ kicker, title, summary, date, siteHost, familyColor }) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: '1200px',
        height: '630px',
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', width: '14px', height: '630px', background: familyColor },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '72px',
              paddingLeft: '76px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '4px',
                    color: '#666666',
                  },
                  children: kicker,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '64px',
                    height: '3px',
                    background: OCHRE,
                    margin: '20px 0',
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: `${titleFontSize(title)}px`,
                    fontWeight: 700,
                    lineHeight: 1.08,
                    color: '#000000',
                  },
                  children: title,
                },
              },
              summary
                ? {
                    type: 'div',
                    props: {
                      style: {
                        display: 'block',
                        marginTop: '20px',
                        fontSize: '25px',
                        fontWeight: 400,
                        color: '#444444',
                        lineHeight: 1.4,
                        lineClamp: 3,
                      },
                      children: summary,
                    },
                  }
                : null,
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    marginTop: 'auto',
                    alignItems: 'center',
                    justifyContent: date ? 'space-between' : 'flex-end',
                  },
                  children: [
                    date
                      ? {
                          type: 'div',
                          props: {
                            style: { display: 'flex', fontSize: '22px', color: '#666666' },
                            children: date,
                          },
                        }
                      : null,
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', fontSize: '22px', fontWeight: 700, color: '#000000' },
                        children: siteHost,
                      },
                    },
                  ].filter(Boolean),
                },
              },
            ].filter(Boolean),
          },
        },
      ],
    },
  }
}

// Character-count safety net under the dynamic title sizing / summary
// lineClamp above — keeps pathological frontmatter from blowing past the
// card even before layout kicks in.
function clamp(str, max) {
  if (!str) return ''
  if (str.length <= max) return str
  return `${str.slice(0, max - 1).trimEnd()}…`
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

async function renderPng({ kicker, title, summary, date, siteHost, familyColor }, fonts) {
  const svg = await satori(ogTree({ kicker, title, summary, date, siteHost, familyColor }), {
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
  const siteHost = new URL(SITE.url).host

  // Default card — used for `/`, `/blog`, and any route without a bespoke
  // cover.
  const defaultPng = await renderPng(
    {
      kicker: 'VILHELM TOIVONEN',
      title: SITE.name,
      summary: clamp(SITE.description, 240),
      date: null,
      siteHost,
      familyColor: OCHRE,
    },
    fonts
  )
  fs.writeFileSync(path.join(outDir, 'default.png'), defaultPng)
  console.log('  wrote dist/og/default.png')

  for (const post of listPosts()) {
    const png = await renderPng(
      {
        kicker: 'VILHELM TOIVONEN — WRITING',
        title: clamp(post.title, 140),
        summary: clamp(post.summary, 240),
        date: formatDate(post.publishedAt),
        siteHost,
        familyColor: familyColorOf(post.tags),
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
