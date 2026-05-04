/**
 * Hierarchical tag tree for blog posts.
 *
 * Posts tag with slash-separated paths from this tree, e.g.
 * `language-models/architecture/attention`. Paths are validated in
 * `src/schemas/post.ts` against `validTagPaths`. Cross-cutting posts tag
 * multiply rather than reaching for a fourth level.
 *
 * Depth: 1–3. A `null` leaf-map means the top-level is itself a usable tag
 * (`lab-notes`). An empty array under a mid-level means the mid-level is
 * itself the usable tag (`ml-systems/serving`).
 */

type LeafList = readonly string[]
type MidMap = { readonly [mid: string]: LeafList }

export const tagTree = {
  'language-models': {
    architecture: ['attention', 'feed-forward', 'normalization', 'positional', 'sequence-modeling'],
    training: [
      'pretraining',
      'supervised-finetuning',
      'preference-optimization',
      'reasoning-rl',
      'distillation',
    ],
    inference: [
      'quantization',
      'speculative-decoding',
      'kv-cache',
      'batching',
      'sampling',
      'test-time-training',
    ],
    interpretability: [],
    evaluation: [],
    alignment: [],
    agents: [],
    multimodal: [],
  },
  'ml-systems': {
    serving: [],
    hardware: [],
    parallelism: [],
    storage: [],
  },
  optimization: {
    'first-order': [],
    'reinforcement-learning': [],
    'low-rank': [],
    'loss-landscape': [],
  },
  math: {
    probability: [],
    'linear-algebra': [],
    'information-theory': [],
  },
  'lab-notes': null,
} as const satisfies Record<string, MidMap | null>

export type TopLevelTag = keyof typeof tagTree

function enumerate(): string[] {
  const out: string[] = []
  for (const [top, mids] of Object.entries(tagTree)) {
    if (mids === null) {
      out.push(top)
      continue
    }
    for (const [mid, leaves] of Object.entries(mids)) {
      if (leaves.length === 0) {
        out.push(`${top}/${mid}`)
        continue
      }
      for (const leaf of leaves) {
        out.push(`${top}/${mid}/${leaf}`)
      }
    }
  }
  return out
}

export const validTagPaths: ReadonlySet<string> = new Set(enumerate())

export function isValidTag(tag: string): boolean {
  return validTagPaths.has(tag)
}

export function topLevelOf(tag: string): string {
  return tag.split('/', 1)[0]
}
