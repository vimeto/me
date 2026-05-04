import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// bf16 bytes per scalar.
const BYTES_PER_ELEM = 2

// Per-layer KV-cache bytes for each variant at a given context T.
//
// The math sketches:
//   MHA      : 2 · h · d · T               (bf16, both K and V)
//   GQA      : 2 · (h/g) · d · T           (h/g KV heads shared across queries)
//   MLA      : (d_c + ropeDim) · T          (low-rank latent + tiny RoPE key)
//   Linear   : h · d · d                    (constant-in-T recurrent state)
//   NSA      : compressed-blocks + selected-blocks + sliding-window     (sub-linear)
//   DSA      : 2 · h · d · k                (top-k selection, k « T)
//   Hybrid3:1: 0.75·linear + 0.25·MLA       (3 linear layers per softmax layer)
//
// All numbers below assume bf16 weights, since that's the de-facto inference dtype
// for every model in the post's attribution table.
function perLayerBytes(
  variant: string,
  T: number,
  args: {
    heads: number
    headDim: number
    gqaGroup: number
    dCompress: number
    ropeDim: number
    mlaRopeHeads: number
    nsaBlock: number
    nsaSelectBlocks: number
    nsaSlidingWindow: number
    dsaTopK: number
    hybridLinearFrac: number
  }
): number {
  const {
    heads,
    headDim,
    gqaGroup,
    dCompress,
    ropeDim,
    mlaRopeHeads,
    nsaBlock,
    nsaSelectBlocks,
    nsaSlidingWindow,
    dsaTopK,
    hybridLinearFrac,
  } = args

  switch (variant) {
    case 'MHA':
      return 2 * heads * headDim * T * BYTES_PER_ELEM
    case 'GQA':
      return 2 * (heads / gqaGroup) * headDim * T * BYTES_PER_ELEM
    case 'MLA':
      return BYTES_PER_ELEM * dCompress * T + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * T
    case 'linear (lightning)':
      // Constant-in-T recurrent state: h · d · d per layer (one outer-product
      // matrix per head). bf16. This is the "lightning attention" / KDA family.
      return BYTES_PER_ELEM * heads * headDim * headDim
    case 'NSA-effective': {
      // NSA's three branches read at most:
      //   - compressed coarse blocks: ~T / nsaBlock tokens of summary state
      //   - selected fine blocks    : nsaSelectBlocks · nsaBlock tokens
      //   - sliding window          : nsaSlidingWindow tokens
      // All capped, so the effective cost looks like an MHA cache that stops
      // growing past min(T, compressed + selected + window).
      const compressed = T / nsaBlock
      const selected = nsaSelectBlocks * nsaBlock
      const window = nsaSlidingWindow
      const effectiveT = Math.min(T, compressed + selected + window)
      return 2 * heads * headDim * effectiveT * BYTES_PER_ELEM
    }
    case 'DSA-effective': {
      // DSA: lightning indexer is small (FP8, ignored here), and each query
      // attends to top-k keys. Effective per-step KV read scales with k, not T.
      const effectiveT = Math.min(T, dsaTopK)
      return 2 * heads * headDim * effectiveT * BYTES_PER_ELEM
    }
    case 'hybrid 3:1': {
      // 75% linear layers (constant), 25% MLA layers (linear in T).
      const linearShare = hybridLinearFrac
      const mlaShare = 1 - hybridLinearFrac
      const linearBytes = BYTES_PER_ELEM * heads * headDim * headDim
      const mlaBytes = BYTES_PER_ELEM * dCompress * T + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * T
      return linearShare * linearBytes + mlaShare * mlaBytes
    }
    default:
      return 0
  }
}

/**
 * attn.cacheCompare
 *
 * KV-cache footprint vs context length, drawn for the seven attention designs
 * in the post's attribution table:
 *   MHA, GQA, MLA, linear (lightning), NSA-effective, DSA-effective, hybrid 3:1.
 *
 * The shapes:
 *   - MHA / GQA / MLA / hybrid : same family as kimi.kvCacheVsContext
 *   - linear (lightning)        : flat horizontal line (state is constant in T)
 *   - NSA-effective             : grows like MHA until the three NSA branches
 *                                 (compressed, selected, sliding-window) cap
 *                                 the effective cost; then it flattens
 *   - DSA-effective             : grows like MHA until T crosses k, then flat
 *                                 at the top-k cost
 *
 * All curves are total cache (per-layer × layers), reported in GB. A horizontal
 * VRAM-budget line sits on top so the reader sees where each variant cliffs.
 */
export const attnCacheCompare: ComputeFn = (params): ComputeResult => {
  const heads = Math.max(1, Math.round(asNumber(params, 'heads', 32)))
  const headDim = Math.max(8, Math.round(asNumber(params, 'headDim', 128)))
  const layers = Math.max(4, Math.round(asNumber(params, 'layers', 48)))
  const gqaGroup = Math.max(1, Math.round(asNumber(params, 'gqaGroup', 8)))
  const dCompress = Math.max(16, Math.round(asNumber(params, 'dCompress', 512)))
  const dsaTopK = Math.max(64, Math.round(asNumber(params, 'dsaTopK', 2048)))
  const nsaBlock = Math.max(8, Math.round(asNumber(params, 'nsaBlock', 64)))
  const nsaSelectBlocks = Math.max(1, Math.round(asNumber(params, 'nsaSelectBlocks', 16)))
  const nsaSlidingWindow = Math.max(64, Math.round(asNumber(params, 'nsaSlidingWindow', 512)))
  const hybridLinearFrac = Math.min(0.95, Math.max(0, asNumber(params, 'hybridLinearFrac', 0.75)))
  const maxContext = Math.max(4096, Math.round(asNumber(params, 'maxContext', 1_000_000)))
  const vramGB = Math.max(1, asNumber(params, 'vramGB', 80))

  const ropeDim = 64
  const mlaRopeHeads = 1
  const sharedArgs = {
    heads,
    headDim,
    gqaGroup,
    dCompress,
    ropeDim,
    mlaRopeHeads,
    nsaBlock,
    nsaSelectBlocks,
    nsaSlidingWindow,
    dsaTopK,
    hybridLinearFrac,
  }

  const seriesKeys = [
    'MHA',
    'GQA',
    'MLA',
    'linear (lightning)',
    'NSA-effective',
    'DSA-effective',
    'hybrid 3:1',
  ]

  const samples = 121
  const points: Point[] = []
  const atMax: Record<string, number> = {}
  const logMin = Math.log(1024)
  const logMax = Math.log(maxContext)

  for (let i = 0; i < samples; i++) {
    const t = logMin + ((logMax - logMin) * i) / Math.max(1, samples - 1)
    const context = Math.round(Math.exp(t))
    for (const variant of seriesKeys) {
      const totalBytes = perLayerBytes(variant, context, sharedArgs) * layers
      points.push({ x: context, y: totalBytes / 1e9, series: variant })
      if (i === samples - 1) atMax[variant] = totalBytes
    }
  }

  const mhaMax = atMax['MHA'] ?? 0
  const summary: { label: string; value: string }[] = [
    { label: `MHA @ ${maxContext.toLocaleString()} tok`, value: `${(mhaMax / 1e9).toFixed(1)} GB` },
    { label: 'MLA @ max', value: `${((atMax['MLA'] ?? 0) / 1e9).toFixed(2)} GB` },
    {
      label: 'Linear @ max',
      value: `${((atMax['linear (lightning)'] ?? 0) / 1e9).toFixed(3)} GB`,
    },
    {
      label: 'DSA-effective @ max',
      value: `${((atMax['DSA-effective'] ?? 0) / 1e9).toFixed(2)} GB`,
    },
    {
      label: 'NSA-effective @ max',
      value: `${((atMax['NSA-effective'] ?? 0) / 1e9).toFixed(2)} GB`,
    },
    {
      label: 'Hybrid 3:1 @ max',
      value: `${((atMax['hybrid 3:1'] ?? 0) / 1e9).toFixed(2)} GB`,
    },
  ]
  if (mhaMax > 0 && (atMax['hybrid 3:1'] ?? 0) > 0) {
    summary.push({
      label: 'Hybrid vs MHA',
      value: `${(mhaMax / atMax['hybrid 3:1']).toFixed(0)}× smaller`,
    })
  }

  return {
    points,
    seriesKeys,
    xDomain: [1024, maxContext],
    annotations: [{ type: 'hline', y: vramGB, label: `VRAM budget ≈ ${vramGB.toFixed(0)} GB` }],
    summary,
  }
}

/**
 * attn.throughputCompare
 *
 * Memory-bandwidth-bound decode tokens/sec for the same seven variants.
 * Mirrors kimi.decodeRoofline:
 *
 *   tokens/sec ≈ HBM_bandwidth / (KV(T) · batch + W)
 *
 * where W is the weight footprint (amortised across the batch) and KV(T) is
 * the per-sequence KV-cache size from `perLayerBytes` summed over layers.
 *
 * The variants that flatten the cache curve (linear, hybrid, capped sparse)
 * also flatten the throughput curve. The variants that don't (MHA, GQA) bend
 * toward zero as context grows.
 */
export const attnThroughputCompare: ComputeFn = (params): ComputeResult => {
  const heads = Math.max(1, Math.round(asNumber(params, 'heads', 32)))
  const headDim = Math.max(8, Math.round(asNumber(params, 'headDim', 128)))
  const layers = Math.max(4, Math.round(asNumber(params, 'layers', 48)))
  const gqaGroup = Math.max(1, Math.round(asNumber(params, 'gqaGroup', 8)))
  const dCompress = Math.max(16, Math.round(asNumber(params, 'dCompress', 512)))
  const dsaTopK = Math.max(64, Math.round(asNumber(params, 'dsaTopK', 2048)))
  const nsaBlock = Math.max(8, Math.round(asNumber(params, 'nsaBlock', 64)))
  const nsaSelectBlocks = Math.max(1, Math.round(asNumber(params, 'nsaSelectBlocks', 16)))
  const nsaSlidingWindow = Math.max(64, Math.round(asNumber(params, 'nsaSlidingWindow', 512)))
  const hybridLinearFrac = Math.min(0.95, Math.max(0, asNumber(params, 'hybridLinearFrac', 0.75)))
  const maxContext = Math.max(4096, Math.round(asNumber(params, 'maxContext', 1_000_000)))
  const hbmGBs = Math.max(100, asNumber(params, 'hbmGBs', 3000))
  const batch = Math.max(1, Math.round(asNumber(params, 'batch', 1)))
  const weightGB = Math.max(0.1, asNumber(params, 'weightGB', 48))

  const ropeDim = 64
  const mlaRopeHeads = 1
  const sharedArgs = {
    heads,
    headDim,
    gqaGroup,
    dCompress,
    ropeDim,
    mlaRopeHeads,
    nsaBlock,
    nsaSelectBlocks,
    nsaSlidingWindow,
    dsaTopK,
    hybridLinearFrac,
  }

  const seriesKeys = [
    'MHA',
    'GQA',
    'MLA',
    'linear (lightning)',
    'NSA-effective',
    'DSA-effective',
    'hybrid 3:1',
  ]

  const hbmBytesPerSec = hbmGBs * 1e9
  const weightBytes = weightGB * 1e9

  const samples = 121
  const points: Point[] = []
  const atMax: Record<string, number> = {}
  const logMin = Math.log(1024)
  const logMax = Math.log(maxContext)

  for (let i = 0; i < samples; i++) {
    const t = logMin + ((logMax - logMin) * i) / Math.max(1, samples - 1)
    const context = Math.round(Math.exp(t))
    for (const variant of seriesKeys) {
      const cache = perLayerBytes(variant, context, sharedArgs) * layers
      const perStep = cache * batch + weightBytes
      const tps = perStep > 0 ? hbmBytesPerSec / perStep : 0
      points.push({ x: context, y: tps, series: variant })
      if (i === samples - 1) atMax[variant] = tps
    }
  }

  const mhaTps = atMax['MHA'] ?? 0
  const hybridTps = atMax['hybrid 3:1'] ?? 0
  const linearTps = atMax['linear (lightning)'] ?? 0

  const summary: { label: string; value: string }[] = [
    { label: 'HBM bandwidth', value: `${hbmGBs.toFixed(0)} GB/s` },
    { label: 'Batch', value: String(batch) },
    { label: `MHA @ ${maxContext.toLocaleString()}`, value: `${mhaTps.toFixed(1)} tok/s` },
    { label: 'MLA @ max', value: `${(atMax['MLA'] ?? 0).toFixed(1)} tok/s` },
    { label: 'Hybrid 3:1 @ max', value: `${hybridTps.toFixed(1)} tok/s` },
    { label: 'Linear @ max', value: `${linearTps.toFixed(1)} tok/s` },
  ]
  if (mhaTps > 0) {
    summary.push({
      label: 'Hybrid vs MHA',
      value: `${(hybridTps / mhaTps).toFixed(1)}× faster`,
    })
  }

  return {
    points,
    seriesKeys,
    xDomain: [1024, maxContext],
    summary,
  }
}

/**
 * attn.recallVsThroughput
 *
 * Pareto-style scatter at a fixed long context. One dot per variant.
 *   - x-axis: long-context recall (surrogate, hand-tuned per variant).
 *   - y-axis: decode tokens/sec from the same roofline as attnThroughputCompare.
 *
 * Recall numbers are *hand-tuned* and represent the qualitative consensus
 * from open-model needle-in-haystack and recall-heavy benchmarks. This is
 * not a measurement; it's a sketch of the frontier so the reader can see
 * where each variant sits relative to the others.
 *
 * Each point lives on its own series so the chart renders one marker per
 * variant. The seriesKeys order matches the cache-plot order for visual
 * consistency.
 */
export const attnRecallVsThroughput: ComputeFn = (params): ComputeResult => {
  const heads = Math.max(1, Math.round(asNumber(params, 'heads', 32)))
  const headDim = Math.max(8, Math.round(asNumber(params, 'headDim', 128)))
  const layers = Math.max(4, Math.round(asNumber(params, 'layers', 48)))
  const gqaGroup = Math.max(1, Math.round(asNumber(params, 'gqaGroup', 8)))
  const dCompress = Math.max(16, Math.round(asNumber(params, 'dCompress', 512)))
  const dsaTopK = Math.max(64, Math.round(asNumber(params, 'dsaTopK', 2048)))
  const nsaBlock = Math.max(8, Math.round(asNumber(params, 'nsaBlock', 64)))
  const nsaSelectBlocks = Math.max(1, Math.round(asNumber(params, 'nsaSelectBlocks', 16)))
  const nsaSlidingWindow = Math.max(64, Math.round(asNumber(params, 'nsaSlidingWindow', 512)))
  const hybridLinearFrac = Math.min(0.95, Math.max(0, asNumber(params, 'hybridLinearFrac', 0.75)))
  const context = Math.max(8192, Math.round(asNumber(params, 'context', 1_000_000)))
  const hbmGBs = Math.max(100, asNumber(params, 'hbmGBs', 3000))
  const weightGB = Math.max(0.1, asNumber(params, 'weightGB', 48))
  const batch = Math.max(1, Math.round(asNumber(params, 'batch', 1)))
  const recallSpread = Math.min(0.5, Math.max(0, asNumber(params, 'recallSpread', 0.1)))

  const ropeDim = 64
  const mlaRopeHeads = 1
  const sharedArgs = {
    heads,
    headDim,
    gqaGroup,
    dCompress,
    ropeDim,
    mlaRopeHeads,
    nsaBlock,
    nsaSelectBlocks,
    nsaSlidingWindow,
    dsaTopK,
    hybridLinearFrac,
  }

  const hbmBytesPerSec = hbmGBs * 1e9
  const weightBytes = weightGB * 1e9

  // Hand-tuned long-context recall surrogates. Anchored to: full softmax
  // (MHA/GQA) at ~0.95, MLA close behind, hybrid 3:1 slightly down, capped
  // sparse mid, pure linear lowest. These are rough and reflect the rough
  // ordering reported in NIAH/RULER-style tables across the open papers.
  // recallSpread compresses or expands the range — useful for showing how
  // different benchmarks redraw the gap.
  const baseRecall: Record<string, number> = {
    MHA: 0.96,
    GQA: 0.94,
    MLA: 0.92,
    'linear (lightning)': 0.65,
    'NSA-effective': 0.86,
    'DSA-effective': 0.9,
    'hybrid 3:1': 0.91,
  }
  // Stretch around the midpoint so a single slider shows all curves drift apart.
  const stretch = (r: number): number => {
    const mid = 0.85
    const stretched = mid + (r - mid) * (1 + recallSpread * 4)
    return Math.min(0.99, Math.max(0.3, stretched))
  }

  const seriesKeys = [
    'MHA',
    'GQA',
    'MLA',
    'linear (lightning)',
    'NSA-effective',
    'DSA-effective',
    'hybrid 3:1',
  ]

  const points: Point[] = []
  const summary: { label: string; value: string }[] = [
    { label: 'Context', value: context.toLocaleString() },
    { label: 'HBM bandwidth', value: `${hbmGBs.toFixed(0)} GB/s` },
  ]

  for (const variant of seriesKeys) {
    const cache = perLayerBytes(variant, context, sharedArgs) * layers
    const perStep = cache * batch + weightBytes
    const tps = perStep > 0 ? hbmBytesPerSec / perStep : 0
    const recall = stretch(baseRecall[variant] ?? 0.5)
    points.push({ x: recall, y: tps, series: variant })
    summary.push({
      label: variant,
      value: `${recall.toFixed(2)} recall · ${tps.toFixed(0)} tok/s`,
    })
  }

  return {
    points,
    seriesKeys,
    xDomain: [0.3, 1],
    summary,
  }
}
