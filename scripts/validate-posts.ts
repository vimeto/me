#!/usr/bin/env tsx
/**
 * Static validator for blog MDX posts.
 *
 *  - Parses frontmatter + validates against PostFrontmatter
 *  - Parses MDX via unified + remark-mdx and walks every JSX element
 *  - Rejects elements that aren't either native HTML or a registered block
 *  - Rejects non-literal prop expressions (identifiers, calls, spreads, …)
 *  - Round-trips literal props through the matching Zod schema
 *  - Checks <ParamPlot compute="…"> keys resolve in the compute registry
 *  - Compiles the file with @mdx-js/mdx to catch any syntax error we missed
 *
 * Usage:
 *   tsx scripts/validate-posts.ts                 # default glob
 *   tsx scripts/validate-posts.ts path/to/a.mdx   # explicit files
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import { compile } from '@mdx-js/mdx'
import type { Node, Position } from 'unist'
import type { z } from 'zod'

import { PostFrontmatter } from '../src/schemas/post.ts'
import { blockNames, blockSchemas, type BlockName } from '../src/schemas/blocks.ts'
import { computeRegistry } from '../src/components/mdx/compute/index.ts'

type Severity = 'error' | 'warn'

export type Issue = {
  file: string
  line: number
  column: number
  severity: Severity
  code: string
  message: string
  snippet?: string
}

const DEFAULT_GLOB = 'content/posts/**/index.mdx'
const NATIVE_HTML_RX = /^[a-z]/ // JSX treats lowercase names as intrinsic HTML/SVG

const cwd = process.cwd()

function rel(p: string) {
  return path.relative(cwd, p) || p
}

function posOrZero(p?: Position | null): { line: number; column: number } {
  return { line: p?.start.line ?? 0, column: p?.start.column ?? 0 }
}

function snippet(source: string, p?: Position | null, max = 120) {
  if (!p?.start) return undefined
  const lines = source.split(/\r?\n/)
  const i = p.start.line - 1
  const line = lines[i] ?? ''
  return line.length > max ? line.slice(0, max - 1) + '…' : line
}

// ---------------------------------------------------------------------------
// Literal prop expression check + conversion
// ---------------------------------------------------------------------------

type EsNode = {
  type: string
  value?: unknown
  operator?: string
  argument?: EsNode
  elements?: (EsNode | null)[]
  properties?: Array<{
    type: string
    key?: EsNode
    value?: EsNode
    kind?: string
    method?: boolean
    computed?: boolean
    shorthand?: boolean
  }>
  name?: string
  expression?: EsNode
  body?: EsNode[]
  raw?: string
}

class LiteralError extends Error {
  constructor(public reason: string) {
    super(reason)
  }
}

function evalLiteral(node: EsNode): unknown {
  if (!node) throw new LiteralError('empty expression')
  switch (node.type) {
    case 'Literal':
      return node.value
    case 'UnaryExpression': {
      if (node.operator !== '-' && node.operator !== '+') {
        throw new LiteralError(`unsupported unary operator '${node.operator}'`)
      }
      const inner = evalLiteral(node.argument as EsNode)
      if (typeof inner !== 'number') throw new LiteralError('unary applied to non-number')
      return node.operator === '-' ? -inner : inner
    }
    case 'ArrayExpression':
      return (node.elements ?? []).map((e) => {
        if (e === null) throw new LiteralError('sparse array element')
        if (e.type === 'SpreadElement') throw new LiteralError('array spread is not literal')
        return evalLiteral(e)
      })
    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {}
      for (const p of node.properties ?? []) {
        if (p.type === 'SpreadElement') throw new LiteralError('object spread is not literal')
        if (p.type !== 'Property') throw new LiteralError(`unexpected ${p.type}`)
        if (p.method) throw new LiteralError('object methods are not literal')
        if (p.shorthand) throw new LiteralError('shorthand properties reference identifiers')
        if (p.computed) throw new LiteralError('computed keys are not literal')
        let key: string
        if (p.key?.type === 'Identifier') key = p.key.name as string
        else if (p.key?.type === 'Literal' && typeof p.key.value === 'string')
          key = p.key.value as string
        else throw new LiteralError('unsupported property key')
        obj[key] = evalLiteral(p.value as EsNode)
      }
      return obj
    }
    case 'TemplateLiteral':
      throw new LiteralError('template literals are not allowed (use plain string)')
    case 'Identifier':
      throw new LiteralError(`identifier '${node.name}' — props must be literals`)
    case 'CallExpression':
    case 'MemberExpression':
    case 'NewExpression':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'TaggedTemplateExpression':
    case 'ConditionalExpression':
    case 'LogicalExpression':
    case 'BinaryExpression':
    case 'SequenceExpression':
    case 'JSXElement':
      throw new LiteralError(`'${node.type}' — props must be literals`)
    default:
      throw new LiteralError(`unsupported expression '${node.type}'`)
  }
}

// ---------------------------------------------------------------------------
// MDX JSX walk
// ---------------------------------------------------------------------------

type JsxAttribute = {
  type: 'mdxJsxAttribute'
  name: string
  value:
    | null
    | string
    | {
        type: 'mdxJsxAttributeValueExpression'
        value: string
        data?: { estree?: { body?: Array<{ type: string; expression?: EsNode }> } }
      }
  position?: Position
}

type JsxExpressionAttribute = {
  type: 'mdxJsxExpressionAttribute'
  value: string
  position?: Position
}

type MdxJsxElement = Node & {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string | null
  attributes: (JsxAttribute | JsxExpressionAttribute)[]
  position?: Position
}

function valueFromAttribute(
  attr: JsxAttribute,
  source: string,
  file: string,
  issues: Issue[]
): { ok: boolean; value?: unknown } {
  // shorthand: <Foo bar/>  → bar: true
  if (attr.value === null || attr.value === undefined) {
    return { ok: true, value: true }
  }
  // raw string: <Foo bar="baz"/>
  if (typeof attr.value === 'string') {
    return { ok: true, value: attr.value }
  }
  // expression: <Foo bar={…}/>
  const expr = attr.value
  const program = expr.data?.estree
  const top = program?.body?.[0]
  if (!top || top.type !== 'ExpressionStatement' || !top.expression) {
    issues.push({
      file,
      ...posOrZero(attr.position),
      severity: 'error',
      code: 'literal-props',
      message: `prop '${attr.name}' is not a pure literal expression`,
      snippet: snippet(source, attr.position),
    })
    return { ok: false }
  }
  try {
    const value = evalLiteral(top.expression)
    return { ok: true, value }
  } catch (e) {
    const reason = e instanceof LiteralError ? e.reason : String(e)
    issues.push({
      file,
      ...posOrZero(attr.position),
      severity: 'error',
      code: 'literal-props',
      message: `prop '${attr.name}' is not a pure literal: ${reason}`,
      snippet: snippet(source, attr.position),
    })
    return { ok: false }
  }
}

/**
 * gray-matter's YAML loader converts bare ISO-date strings (e.g. `2026-04-21`)
 * into JS Date objects. Our runtime pipeline (remark-mdx-frontmatter) keeps
 * them as strings, and the Zod schema expects strings. Normalize before
 * validating so the two paths agree.
 */
function normalizeFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 10)
    else out[k] = v
  }
  return out
}

function formatZodIssues(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const p = i.path.length ? i.path.join('.') : '(root)'
      return `${p}: ${i.message}`
    })
    .join('; ')
}

export async function validateOne(file: string): Promise<Issue[]> {
  const absolute = path.resolve(cwd, file)
  const rawSource = await fs.readFile(absolute, 'utf8')
  const displayPath = rel(absolute)
  const issues: Issue[] = []

  // --- Frontmatter --------------------------------------------------------
  const fmStartLine = 1
  try {
    const parsed = matter(rawSource)
    const fmData = normalizeFrontmatter(parsed.data)
    const fmResult = PostFrontmatter.safeParse(fmData)
    if (!fmResult.success) {
      for (const zi of fmResult.error.issues) {
        issues.push({
          file: displayPath,
          line: fmStartLine,
          column: 1,
          severity: 'error',
          code: 'frontmatter',
          message: `frontmatter.${zi.path.join('.') || '(root)'}: ${zi.message}`,
        })
      }
    }
  } catch (e) {
    issues.push({
      file: displayPath,
      line: 1,
      column: 1,
      severity: 'error',
      code: 'frontmatter-parse',
      message: `frontmatter could not be parsed: ${(e as Error).message}`,
    })
  }

  // --- Parse MDX tree -----------------------------------------------------
  let tree: Node | null = null
  try {
    tree = unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(remarkMath)
      .parse(rawSource) as Node
  } catch (e) {
    const err = e as Error & { line?: number; column?: number }
    issues.push({
      file: displayPath,
      line: err.line ?? 1,
      column: err.column ?? 1,
      severity: 'error',
      code: 'mdx-parse',
      message: err.message,
    })
  }

  // --- JSX walk -----------------------------------------------------------
  if (tree) {
    visit(tree, (node: Node) => {
      if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return
      const el = node as MdxJsxElement
      const name = el.name
      if (!name) return // fragment <>…</> — allowed
      const isNative = NATIVE_HTML_RX.test(name)
      const isRegistered = (blockNames as string[]).includes(name)

      if (!isNative && !isRegistered) {
        issues.push({
          file: displayPath,
          ...posOrZero(el.position),
          severity: 'error',
          code: 'unknown-block',
          message: `<${name}> is not a registered block. Known blocks: ${blockNames.join(', ')}`,
          snippet: snippet(rawSource, el.position),
        })
        return
      }
      if (!isRegistered) return // native tag — no prop schema to check

      const blockName = name as BlockName
      const props: Record<string, unknown> = {}
      let allLiteral = true

      for (const attr of el.attributes) {
        if (attr.type === 'mdxJsxExpressionAttribute') {
          issues.push({
            file: displayPath,
            ...posOrZero(attr.position),
            severity: 'error',
            code: 'literal-props',
            message: `spread / expression attributes are not allowed on <${name}>`,
            snippet: snippet(rawSource, attr.position),
          })
          allLiteral = false
          continue
        }
        const r = valueFromAttribute(attr, rawSource, displayPath, issues)
        if (!r.ok) {
          allLiteral = false
          continue
        }
        props[attr.name] = r.value
      }

      if (!allLiteral) return

      const schema = blockSchemas[blockName]
      const result = schema.safeParse(props)
      if (!result.success) {
        issues.push({
          file: displayPath,
          ...posOrZero(el.position),
          severity: 'error',
          code: 'schema',
          message: `<${name}> ${formatZodIssues(result.error)}`,
          snippet: snippet(rawSource, el.position),
        })
        return
      }

      // Block-specific cross-checks
      if (blockName === 'ParamPlot') {
        const computeKey = (result.data as { compute: string }).compute
        if (!Object.prototype.hasOwnProperty.call(computeRegistry, computeKey)) {
          issues.push({
            file: displayPath,
            ...posOrZero(el.position),
            severity: 'error',
            code: 'unknown-compute',
            message: `<ParamPlot compute="${computeKey}"> is not registered. Known: ${Object.keys(
              computeRegistry
            ).join(', ')}`,
            snippet: snippet(rawSource, el.position),
          })
        }
      }
    })
  }

  // --- Compile sanity -----------------------------------------------------
  try {
    await compile(rawSource, {
      format: 'mdx',
      remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath],
    })
  } catch (e) {
    const err = e as Error & { line?: number; column?: number }
    issues.push({
      file: displayPath,
      line: err.line ?? 1,
      column: err.column ?? 1,
      severity: 'error',
      code: 'mdx-compile',
      message: err.message,
    })
  }

  return issues
}

async function main() {
  const argv = process.argv.slice(2)
  let files: string[]
  if (argv.length === 0) {
    files = await fg(DEFAULT_GLOB, { cwd, absolute: true })
  } else {
    files = argv.map((a) => path.resolve(cwd, a))
  }

  if (files.length === 0) {
    console.error('No posts matched.')
    process.exit(0)
  }

  let totalErrors = 0
  for (const f of files) {
    const issues = await validateOne(f)
    const errs = issues.filter((i) => i.severity === 'error')
    totalErrors += errs.length
    if (issues.length === 0) {
      console.log(`✓ ${rel(f)}`)
      continue
    }
    console.log(`✗ ${rel(f)}`)
    for (const i of issues) {
      const loc = `${i.file}:${i.line}:${i.column}`
      console.log(`  ${i.severity.toUpperCase()} [${i.code}] ${loc}`)
      console.log(`    ${i.message}`)
      if (i.snippet) console.log(`    | ${i.snippet}`)
    }
  }

  if (totalErrors > 0) {
    console.error(`\n${totalErrors} error(s) across ${files.length} file(s)`)
    process.exit(1)
  }
  console.log(`\nAll ${files.length} post(s) valid.`)
}

// Only auto-run when invoked as a script (not when imported by smoke tests).
const isCli = import.meta.url === `file://${process.argv[1]}`
if (isCli) {
  main().catch((e) => {
    console.error(e)
    process.exit(2)
  })
}
