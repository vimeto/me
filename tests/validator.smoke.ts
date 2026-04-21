#!/usr/bin/env tsx
/**
 * Smoke tests for scripts/validate-posts.ts.
 *
 * Each entry maps a broken fixture to the error code we expect the validator
 * to emit. A final case runs the known-good fixture and asserts zero errors.
 */
import path from 'node:path'
import process from 'node:process'
import { validateOne, type Issue } from '../scripts/validate-posts.ts'

type Case = {
  file: string
  expect:
    | { ok: true }
    | {
        ok: false
        codes: string[] // all must appear
        lineAtLeast?: number
      }
}

const cases: Case[] = [
  { file: 'tests/fixtures/good-post.mdx', expect: { ok: true } },
  {
    file: 'tests/fixtures/bad-slug.mdx',
    expect: { ok: false, codes: ['frontmatter'] },
  },
  {
    file: 'tests/fixtures/missing-title.mdx',
    expect: { ok: false, codes: ['frontmatter'] },
  },
  {
    file: 'tests/fixtures/unknown-block.mdx',
    expect: { ok: false, codes: ['unknown-block'], lineAtLeast: 9 },
  },
  {
    file: 'tests/fixtures/non-literal-prop.mdx',
    expect: { ok: false, codes: ['literal-props'] },
  },
  {
    file: 'tests/fixtures/spread-prop.mdx',
    expect: { ok: false, codes: ['literal-props'] },
  },
  {
    file: 'tests/fixtures/schema-bad-enum.mdx',
    expect: { ok: false, codes: ['schema'] },
  },
  {
    file: 'tests/fixtures/schema-missing-required.mdx',
    expect: { ok: false, codes: ['schema'] },
  },
  {
    file: 'tests/fixtures/unknown-compute.mdx',
    expect: { ok: false, codes: ['unknown-compute'] },
  },
  {
    file: 'tests/fixtures/template-literal-prop.mdx',
    expect: { ok: false, codes: ['literal-props'] },
  },
  {
    file: 'tests/fixtures/call-expression-prop.mdx',
    expect: { ok: false, codes: ['literal-props'] },
  },
  {
    file: 'tests/fixtures/quiz-no-correct.mdx',
    expect: { ok: false, codes: ['schema'] },
  },
  {
    file: 'tests/fixtures/quiz-single-two-correct.mdx',
    expect: { ok: false, codes: ['schema'] },
  },
  {
    file: 'tests/fixtures/quiz-too-few-choices.mdx',
    expect: { ok: false, codes: ['schema'] },
  },
  {
    file: 'tests/fixtures/loopedsvg-bad-preset.mdx',
    expect: { ok: false, codes: ['schema'] },
  },
]

function fmt(issue: Issue): string {
  return `    ${issue.severity.toUpperCase()} [${issue.code}] ${issue.file}:${issue.line}:${issue.column}  ${issue.message}`
}

async function main() {
  let failures = 0
  for (const c of cases) {
    const absolute = path.resolve(process.cwd(), c.file)
    let issues: Issue[]
    try {
      issues = await validateOne(absolute)
    } catch (e) {
      console.log(`✗ ${c.file}  (threw)`)
      console.log(`    ${(e as Error).message}`)
      failures++
      continue
    }
    const errs = issues.filter((i) => i.severity === 'error')
    if (c.expect.ok) {
      if (errs.length === 0) {
        console.log(`✓ ${c.file}  (valid, as expected)`)
      } else {
        console.log(`✗ ${c.file}  expected no errors, got ${errs.length}`)
        for (const i of errs) console.log(fmt(i))
        failures++
      }
      continue
    }
    const codes = new Set(errs.map((i) => i.code))
    const missing = c.expect.codes.filter((code) => !codes.has(code))
    if (missing.length > 0) {
      console.log(`✗ ${c.file}  missing expected codes: ${missing.join(', ')}`)
      console.log(`  got codes: ${[...codes].join(', ') || '(none)'}`)
      for (const i of errs) console.log(fmt(i))
      failures++
      continue
    }
    if (c.expect.lineAtLeast !== undefined) {
      const hit = errs.find((i) => c.expect.ok === false && c.expect.codes.includes(i.code))
      if (!hit || hit.line < c.expect.lineAtLeast) {
        console.log(
          `✗ ${c.file}  expected line >= ${c.expect.lineAtLeast}, got ${hit?.line ?? '?'}`
        )
        failures++
        continue
      }
    }
    console.log(
      `✓ ${c.file}  rejected with [${c.expect.codes.join(', ')}] at ${errs[0].file}:${errs[0].line}:${errs[0].column}`
    )
  }
  if (failures > 0) {
    console.error(`\n${failures} smoke failure(s) out of ${cases.length}`)
    process.exit(1)
  }
  console.log(`\nAll ${cases.length} validator smoke tests passed.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
