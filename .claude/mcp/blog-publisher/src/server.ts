#!/usr/bin/env tsx
// Blog-publisher MCP server.
//
// Exposes a small set of tools an LLM can use to author blog posts in this
// repo: list/read posts, create drafts, publish drafts, validate, and read
// the block registry catalog.
//
// Transport: stdio — spawn from Claude Desktop / Cursor / any MCP client.
// Entry point: `tsx .claude/mcp/blog-publisher/src/server.ts` (or use the
// top-level `pnpm mcp:blog-publisher` script).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  createDraft,
  listPosts,
  publishDraft,
  readPost,
  readRegistryCatalog,
  validatePost,
} from './core.js'

// Resolve the repo root once. The server file sits at
// `<repo>/.claude/mcp/blog-publisher/src/server.ts`, so the root is four
// levels up (src → blog-publisher → mcp → .claude → repo).
const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(here, '..', '..', '..', '..')

function okResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}
function errResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true }
}
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const server = new McpServer(
  { name: 'blog-publisher', version: '0.1.0' },
  {
    capabilities: { tools: {}, resources: {} },
    instructions:
      'Tools for authoring blog posts in the personal_page repo. Use `list_posts` to ' +
      'discover existing content, `read_post` to inspect one, `create_draft` to start a ' +
      'new post in content/drafts/, `publish_draft` to move it to content/posts/, and ' +
      '`validate_posts` to run the static validator. The `block_catalog` resource ' +
      'documents every MDX block, its props, and its Zod schema.',
  }
)

server.tool(
  'list_posts',
  'List every post in content/posts/ and content/drafts/, newest first.',
  {
    includeDrafts: z.boolean().optional().describe('Include drafts. Default true.'),
  },
  async ({ includeDrafts }) => {
    try {
      const posts = await listPosts(REPO_ROOT, { includeDrafts })
      return okResult(JSON.stringify(posts, null, 2))
    } catch (err) {
      return errResult(`list_posts failed: ${errorMessage(err)}`)
    }
  }
)

server.tool(
  'read_post',
  'Read a post by slug (published or draft). Returns frontmatter summary + MDX body.',
  {
    slug: z.string().min(1).describe('Post slug, e.g. "two-tails".'),
  },
  async ({ slug }) => {
    try {
      const { summary, content } = await readPost(REPO_ROOT, slug)
      return okResult(JSON.stringify({ summary, content }, null, 2))
    } catch (err) {
      return errResult(`read_post failed: ${errorMessage(err)}`)
    }
  }
)

server.tool(
  'create_draft',
  'Create a new draft at content/drafts/<slug>.mdx. Fails if the slug is already used.',
  {
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, and hyphens'),
    title: z.string().min(1).max(140),
    summary: z.string().min(1).max(320),
    publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'publishedAt must be YYYY-MM-DD'),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    estimatedReadMin: z.number().positive().optional(),
    body: z.string().min(1),
  },
  async (input) => {
    try {
      const res = await createDraft(REPO_ROOT, input)
      return okResult(`Created ${res.path}`)
    } catch (err) {
      return errResult(`create_draft failed: ${errorMessage(err)}`)
    }
  }
)

server.tool(
  'publish_draft',
  'Move a draft from content/drafts/<slug>.mdx to content/posts/<slug>/index.mdx and flip status to "published".',
  {
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, and hyphens'),
  },
  async ({ slug }) => {
    try {
      const res = await publishDraft(REPO_ROOT, slug)
      return okResult(`Moved ${res.from} → ${res.to}`)
    } catch (err) {
      return errResult(`publish_draft failed: ${errorMessage(err)}`)
    }
  }
)

server.tool(
  'validate_posts',
  'Run the static MDX validator. Optionally scope to a single slug.',
  {
    slug: z.string().optional().describe('Slug to validate. If omitted, validates everything.'),
  },
  async ({ slug }) => {
    const res = await validatePost(REPO_ROOT, slug)
    return res.ok
      ? okResult(res.output || 'validator passed')
      : errResult(res.output || 'validator failed')
  }
)

// Static resource: the block registry catalog. Clients use this to learn what
// MDX blocks are available, their props, and which compute keys the
// ParamPlot accepts.
server.resource(
  'block-catalog',
  'blog://block-catalog',
  {
    title: 'Block registry catalog',
    description: 'JSON schema for every MDX block and every compute key.',
    mimeType: 'application/json',
  },
  async () => {
    const text = await readRegistryCatalog(REPO_ROOT)
    return {
      contents: [{ uri: 'blog://block-catalog', text, mimeType: 'application/json' }],
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('blog-publisher MCP server ready (stdio)')
}

main().catch((err) => {
  console.error('blog-publisher MCP server failed:', err)
  process.exit(1)
})
