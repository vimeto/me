import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeShiki from '@shikijs/rehype'
import { postFeaturesPlugin } from './scripts/vite-post-features'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    postFeaturesPlugin(),
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
        [
          rehypeShiki,
          {
            themes: { light: 'github-light', dark: 'github-dark' },
          },
        ],
      ],
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Native fs events don't reach processes spawned by some supervised shells
    // (e.g. agent sandboxes); VITE_POLL=1 falls back to polling there. Normal
    // `pnpm dev` from a terminal is unaffected.
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
  ssr: {
    // visx + d3-array ship as ESM; mark them external-free so they get bundled
    // into the SSR bundle and resolve through our alias + MDX plugin.
    noExternal: ['@visx/*', 'd3-array'],
  },
})
