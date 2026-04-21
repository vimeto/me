#!/usr/bin/env tsx
/**
 * Emits registry-catalog.json — a machine-readable description of every
 * registered block schema and compute function. This is what authoring
 * tools (LLM-first pipelines, doc pages, editor autocomplete) consume to
 * know what's available.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'

import { blockSchemas, blockNames } from '../src/schemas/blocks.ts'
import { computeRegistry } from '../src/components/mdx/compute/index.ts'

const out = path.resolve(process.cwd(), 'registry-catalog.json')

const catalog = {
  generatedAt: new Date().toISOString(),
  blocks: Object.fromEntries(blockNames.map((name) => [name, z.toJSONSchema(blockSchemas[name])])),
  compute: Object.keys(computeRegistry).sort(),
}

await fs.writeFile(out, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
console.log(
  `Wrote ${path.relative(process.cwd(), out)} — ${blockNames.length} block(s), ${catalog.compute.length} compute key(s)`
)
