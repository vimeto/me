# blog-publisher MCP server

An MCP server that exposes the blog authoring workflow of this repo to any
MCP-capable LLM client (Claude Desktop, Cursor, etc.). Tools cover:

- `list_posts` — enumerate existing posts + drafts
- `read_post` — fetch a single post's frontmatter and MDX body
- `create_draft` — start a new draft at `content/drafts/<slug>.mdx`
- `publish_draft` — move a draft to `content/posts/<slug>/index.mdx` and flip status
- `validate_posts` — run the project's static MDX validator

Plus one resource:

- `blog://block-catalog` — the full block and compute-key registry as JSON

## Running

From the repo root:

```
pnpm mcp:blog-publisher
```

The server uses stdio transport, so you normally don't run it by hand — you
register it with an MCP client.

## Wiring into Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blog-publisher": {
      "command": "pnpm",
      "args": ["-C", "/absolute/path/to/personal_page", "mcp:blog-publisher"]
    }
  }
}
```

Replace the path with your local checkout.

## Tests

Unit tests for the core file ops:

```
pnpm mcp:test
```

Each test creates an isolated temp directory — no tests touch the real
`content/` tree.
