import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

// bf16 / fp16 bytes per scalar.
const BYTES_PER_ELEM = 2

/**
 * ssm.edgeMemoryFootprint
 *
 * Per-sequence memory footprint vs context length on a fixed 7B-class shape
 * for five sequence-mixing variants:
 *
 *   - MHA            : 2 · h · d · L · T bytes per layer
 *   - GQA            : 2 · (h / g) · d · L · T bytes per layer (g = group size)
 *   - MLA            : DeepSeek-V2 latent of rank d_c plus a small decoupled
 *                      RoPE channel cached per layer
 *   - Gated DeltaNet : O(h · d_k · d_v) recurrent state per layer, constant
 *                      in T. With d_k = d_v = headDim this is h · d^2 elements
 *   - Mamba-2 / SSD  : d_inner · N state per SSM layer, constant in T.
 *                      d_inner ≈ 2 · model_dim is the Mamba expansion factor
 *
 * A "Mamba-2 / softmax hybrid" line is also emitted: 1 GQA layer per
 * `ratio` Mamba-2 layers, so the GQA term is scaled by 1/(ratio+1).
 *
 * A horizontal band sits at the chosen edge memory budget (default 8 GB
 * "phone after weights"); a vertical line marks the chosen context.
 *
 * The plot is the one I reach for when somebody asks "why bother with SSMs
 * on the edge". The MHA line crosses the budget before the chat history is
 * interesting; the SSM lines are essentially flat.
 */
export const ssmEdgeMemoryFootprint: ComputeFn = (params): ComputeResult => {
  const modelDim = Math.max(512, Math.round(asNumber(params, 'modelDim', 4096)))
  const layers = Math.max(8, Math.round(asNumber(params, 'layers', 32)))
  const headDim = Math.max(32, Math.round(asNumber(params, 'headDim', 128)))
  const heads = Math.max(1, Math.round(modelDim / headDim))
  const gqaGroup = clamp(Math.round(asNumber(params, 'gqaGroup', 8)), 1, heads)
  const stateDim = Math.max(8, Math.round(asNumber(params, 'stateDim', 128)))
  const ratio = Math.max(0, asNumber(params, 'hybridRatio', 7))
  const budgetGB = Math.max(0.5, asNumber(params, 'budgetGB', 8))
  const maxContext = Math.max(8192, Math.round(asNumber(params, 'maxContext', 1_048_576)))
  const markContext = clamp(Math.round(asNumber(params, 'context', 65536)), 1024, maxContext)

  // MLA latent rank — DeepSeek-V2 uses 512 against a 5120 model dim, so we
  // scale roughly with model dim while staying bounded.
  const dCompress = Math.max(64, Math.round(modelDim / 8))
  const ropeDim = 64
  const mlaRopeHeads = 1

  // Mamba-2 expansion: d_inner = 2 · model_dim is the standard Mamba-2 ratio.
  const dInner = 2 * modelDim
  // Gated DeltaNet state: (h · d_k · d_v) per layer — d_k = d_v = headDim.
  const deltaStateBytes = BYTES_PER_ELEM * heads * headDim * headDim
  // Mamba-2 recurrent state: d_inner · N per layer.
  const mambaStateBytes = BYTES_PER_ELEM * dInner * stateDim

  // Cache for one layer at context T, by variant.
  const mhaPerLayer = (T: number) => 2 * heads * headDim * T * BYTES_PER_ELEM
  const gqaPerLayer = (T: number) => 2 * (heads / gqaGroup) * headDim * T * BYTES_PER_ELEM
  const mlaPerLayer = (T: number) =>
    BYTES_PER_ELEM * dCompress * T + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * T

  // Hybrid: 1 attention layer per `ratio` Mamba-2 layers.
  const mambaFrac = ratio / (ratio + 1)
  const attnFrac = 1 / (ratio + 1)

  const samples = 121
  const logMin = Math.log(1024)
  const logMax = Math.log(maxContext)
  const points: Point[] = []

  let mhaAtMark = 0
  let gqaAtMark = 0
  let mlaAtMark = 0
  let deltaAtMark = 0
  let mambaAtMark = 0
  let hybridAtMark = 0

  let firstHit: number | null = null

  for (let i = 0; i < samples; i++) {
    const t = logMin + ((logMax - logMin) * i) / (samples - 1)
    const T = Math.round(Math.exp(t))

    const mha = mhaPerLayer(T) * layers
    const gqa = gqaPerLayer(T) * layers
    const mla = mlaPerLayer(T) * layers
    const delta = deltaStateBytes * layers
    const mamba = mambaStateBytes * layers
    const hybrid = mambaStateBytes * layers * mambaFrac + gqaPerLayer(T) * layers * attnFrac

    points.push({ x: T, y: mha / 1e9, series: 'MHA' })
    points.push({ x: T, y: gqa / 1e9, series: 'GQA' })
    points.push({ x: T, y: mla / 1e9, series: 'MLA' })
    points.push({ x: T, y: delta / 1e9, series: 'Gated DeltaNet' })
    points.push({ x: T, y: mamba / 1e9, series: 'Mamba-2' })
    points.push({ x: T, y: hybrid / 1e9, series: `Mamba-2 / attn ${ratio}:1` })

    // First context where MHA punches through the budget.
    if (firstHit === null && mha / 1e9 > budgetGB) firstHit = T

    if (Math.abs(t - Math.log(markContext)) < (logMax - logMin) / (samples - 1)) {
      mhaAtMark = mha
      gqaAtMark = gqa
      mlaAtMark = mla
      deltaAtMark = delta
      mambaAtMark = mamba
      hybridAtMark = hybrid
    }
  }

  const fmt = (b: number): string => {
    const gb = b / 1e9
    if (gb >= 1) return `${gb.toFixed(2)} GB`
    const mb = b / 1e6
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    return `${(b / 1e3).toFixed(0)} KB`
  }

  const annotations: NonNullable<ComputeResult['annotations']> = [
    { type: 'hline', y: budgetGB, label: `edge budget ≈ ${budgetGB.toFixed(1)} GB` },
    { type: 'vline', x: markContext, label: `T = ${markContext.toLocaleString()} tok` },
  ]
  if (firstHit !== null) {
    annotations.push({
      type: 'vline',
      x: firstHit,
      label: `MHA over budget @ T=${firstHit.toLocaleString()}`,
    })
  }

  return {
    points,
    seriesKeys: ['MHA', 'GQA', 'MLA', 'Gated DeltaNet', 'Mamba-2', `Mamba-2 / attn ${ratio}:1`],
    xDomain: [1024, maxContext],
    annotations,
    summary: [
      { label: 'Model shape', value: `d=${modelDim}, L=${layers}, h=${heads}` },
      { label: `MHA @ ${markContext.toLocaleString()}`, value: fmt(mhaAtMark) },
      { label: `GQA @ ${markContext.toLocaleString()}`, value: fmt(gqaAtMark) },
      { label: `MLA @ ${markContext.toLocaleString()}`, value: fmt(mlaAtMark) },
      { label: 'Gated DeltaNet (any T)', value: fmt(deltaAtMark) },
      { label: 'Mamba-2 (any T)', value: fmt(mambaAtMark) },
      { label: `Hybrid @ ${markContext.toLocaleString()}`, value: fmt(hybridAtMark) },
    ],
  }
}

/**
 * ssm.hybridRatioSweep
 *
 * Sweep the Mamba-2 : softmax-attention layer ratio from 0 (all attention)
 * up to a configurable cap (effectively pure SSM). Two normalised series:
 *
 *   - cache footprint : KV-cache + SSM-state bytes per token at a fixed
 *                       long context. Improves (drops) as the SSM share
 *                       grows because attention layers scale with context
 *                       and SSM layers don't
 *   - recall surrogate: a sigmoid that stays ≈ 1 while at least a few
 *                       attention layers remain, then drops sharply once
 *                       global softmax disappears entirely. Toy, but it
 *                       matches the qualitative ablation evidence
 *
 * Vertical lines mark Granite 4's 9:1 and Kimi Linear's 3:1 picks. The
 * gap between them is the "knee location depends on what you're optimising"
 * point — Granite optimised cache, Kimi optimised quality.
 */
export const ssmHybridRatioSweep: ComputeFn = (params): ComputeResult => {
  const modelDim = Math.max(512, Math.round(asNumber(params, 'modelDim', 4096)))
  const layers = Math.max(8, Math.round(asNumber(params, 'layers', 32)))
  const headDim = Math.max(32, Math.round(asNumber(params, 'headDim', 128)))
  const heads = Math.max(1, Math.round(modelDim / headDim))
  const gqaGroup = clamp(Math.round(asNumber(params, 'gqaGroup', 8)), 1, heads)
  const stateDim = Math.max(8, Math.round(asNumber(params, 'stateDim', 128)))
  const context = Math.max(4096, Math.round(asNumber(params, 'context', 131072)))
  const recallPenalty = clamp(asNumber(params, 'recallPenalty', 0.4), 0, 2)
  const maxRatio = clamp(asNumber(params, 'maxRatio', 12), 2, 24)

  const dInner = 2 * modelDim
  const mambaStateBytes = BYTES_PER_ELEM * dInner * stateDim
  const gqaPerLayer = (T: number) => 2 * (heads / gqaGroup) * headDim * T * BYTES_PER_ELEM

  const samples = 121
  const ratios: number[] = []
  for (let i = 0; i < samples; i++) {
    ratios.push((maxRatio * i) / (samples - 1))
  }

  // Reference: the "all attention" cache (ratio = 0).
  const allAttnCache = gqaPerLayer(context) * layers
  const allMambaCache = mambaStateBytes * layers

  const points: Point[] = []
  let kneeRatio = 0
  let kneeScore = -Infinity
  for (const r of ratios) {
    const mambaFrac = r / (r + 1)
    const attnFrac = 1 - mambaFrac
    const cache = mambaStateBytes * layers * mambaFrac + gqaPerLayer(context) * layers * attnFrac

    // Cache savings as a 0..1 score (higher = better, normalised to the
    // gap between all-attention and all-SSM).
    const cacheScore = clamp(
      (allAttnCache - cache) / Math.max(1, allAttnCache - allMambaCache),
      0,
      1
    )

    // Recall surrogate. While at least a small share of layers is softmax,
    // recall stays high — the global lookups are still there, just rarer.
    // Once attnFrac → 0 the curve falls off fast. Knee + scale are tuned so
    // the 9:1 (attnFrac = 0.1) point sits comfortably above the cliff for
    // small recallPenalty and slips closer to it as the penalty grows.
    const knee = 0.04 + 0.06 * recallPenalty
    const scale = 0.06
    const x = (attnFrac - knee) / scale
    const recall = 1 / (1 + Math.exp(-x))

    points.push({ x: r, y: cacheScore, series: 'cache savings (norm.)' })
    points.push({ x: r, y: recall, series: 'recall surrogate' })

    const score = Math.sqrt(Math.max(0, cacheScore) * Math.max(0, recall))
    if (score > kneeScore) {
      kneeScore = score
      kneeRatio = r
    }
  }

  // Cache + recall at the two named picks.
  const evalAt = (r: number): { cacheGB: number; recall: number } => {
    const mambaFrac = r / (r + 1)
    const attnFrac = 1 - mambaFrac
    const cache = mambaStateBytes * layers * mambaFrac + gqaPerLayer(context) * layers * attnFrac
    const knee = 0.04 + 0.06 * recallPenalty
    const scale = 0.06
    const x = (attnFrac - knee) / scale
    const recall = 1 / (1 + Math.exp(-x))
    return { cacheGB: cache / 1e9, recall }
  }
  const granite = evalAt(9)
  const kimi = evalAt(3)

  return {
    points,
    seriesKeys: ['cache savings (norm.)', 'recall surrogate'],
    xDomain: [0, maxRatio],
    yDomain: [0, 1.05],
    annotations: [
      { type: 'vline', x: 3, label: 'Kimi Linear 3:1' },
      { type: 'vline', x: 9, label: 'Granite 4 9:1' },
      { type: 'vline', x: kneeRatio, label: `surrogate knee ≈ ${kneeRatio.toFixed(1)}:1` },
    ],
    summary: [
      { label: 'Context', value: context.toLocaleString() },
      { label: 'All-attention cache', value: `${(allAttnCache / 1e9).toFixed(2)} GB` },
      { label: 'All-Mamba state', value: `${(allMambaCache / 1e9).toFixed(3)} GB` },
      {
        label: '3:1 (Kimi)',
        value: `cache ${kimi.cacheGB.toFixed(2)} GB · recall ${kimi.recall.toFixed(2)}`,
      },
      {
        label: '9:1 (Granite)',
        value: `cache ${granite.cacheGB.toFixed(2)} GB · recall ${granite.recall.toFixed(2)}`,
      },
      { label: 'Surrogate knee', value: `${kneeRatio.toFixed(1)}:1` },
    ],
  }
}

/**
 * ssm.streamingDecodeLatency
 *
 * Per-token decode latency (ms) vs context length on an edge bandwidth
 * budget for the same five variants as ssm.edgeMemoryFootprint plus a
 * Mamba-2 / softmax hybrid. Decode at batch 1 is bandwidth-bound: each
 * generated token reads weights + per-sequence cache.
 *
 *   ms_per_token = (weight_bytes + cache_bytes_at_T) / bandwidth · 1000
 *
 * MHA hockey-sticks as T grows because cache_bytes scales with T. Mamba-2
 * and Gated DeltaNet are flat (constant state). MLA tilts gently. The plot
 * is shaped to motivate why edge inference (low-bandwidth, sequential, KV
 * cache outgrows weights at modest T) cares about SSM-style state more
 * than data-centre inference does.
 *
 * Bandwidth defaults to 135 GB/s — Snapdragon X Elite class. Slide it up
 * for Apple unified memory (~410 GB/s on M4 Max) or H100 (~3350 GB/s) and
 * the picture changes: at 3 TB/s every variant looks fast at 64k.
 */
export const ssmStreamingDecodeLatency: ComputeFn = (params): ComputeResult => {
  const modelDim = Math.max(512, Math.round(asNumber(params, 'modelDim', 4096)))
  const layers = Math.max(8, Math.round(asNumber(params, 'layers', 32)))
  const headDim = Math.max(32, Math.round(asNumber(params, 'headDim', 128)))
  const heads = Math.max(1, Math.round(modelDim / headDim))
  const gqaGroup = clamp(Math.round(asNumber(params, 'gqaGroup', 8)), 1, heads)
  const stateDim = Math.max(8, Math.round(asNumber(params, 'stateDim', 128)))
  const ratio = Math.max(0, asNumber(params, 'hybridRatio', 7))
  const bandwidthGBs = Math.max(20, asNumber(params, 'bandwidthGBs', 135))
  const weightGB = Math.max(0.5, asNumber(params, 'weightGB', 4))
  const maxContext = Math.max(8192, Math.round(asNumber(params, 'maxContext', 262144)))

  const dCompress = Math.max(64, Math.round(modelDim / 8))
  const ropeDim = 64
  const mlaRopeHeads = 1
  const dInner = 2 * modelDim
  const deltaStateBytes = BYTES_PER_ELEM * heads * headDim * headDim
  const mambaStateBytes = BYTES_PER_ELEM * dInner * stateDim

  const bandwidth = bandwidthGBs * 1e9
  const weightBytes = weightGB * 1e9

  const mhaPerLayer = (T: number) => 2 * heads * headDim * T * BYTES_PER_ELEM
  const gqaPerLayer = (T: number) => 2 * (heads / gqaGroup) * headDim * T * BYTES_PER_ELEM
  const mlaPerLayer = (T: number) =>
    BYTES_PER_ELEM * dCompress * T + BYTES_PER_ELEM * mlaRopeHeads * ropeDim * T

  const mambaFrac = ratio / (ratio + 1)
  const attnFrac = 1 / (ratio + 1)

  const samples = 121
  const logMin = Math.log(1024)
  const logMax = Math.log(maxContext)
  const points: Point[] = []

  let mhaAtMax = 0
  let mambaAtMax = 0
  let hybridAtMax = 0

  for (let i = 0; i < samples; i++) {
    const t = logMin + ((logMax - logMin) * i) / (samples - 1)
    const T = Math.round(Math.exp(t))

    const mhaCache = mhaPerLayer(T) * layers
    const gqaCache = gqaPerLayer(T) * layers
    const mlaCache = mlaPerLayer(T) * layers
    const deltaCache = deltaStateBytes * layers
    const mambaCache = mambaStateBytes * layers
    const hybridCache = mambaStateBytes * layers * mambaFrac + gqaPerLayer(T) * layers * attnFrac

    const ms = (cache: number) => ((weightBytes + cache) / bandwidth) * 1000

    const mhaMs = ms(mhaCache)
    const gqaMs = ms(gqaCache)
    const mlaMs = ms(mlaCache)
    const deltaMs = ms(deltaCache)
    const mambaMs = ms(mambaCache)
    const hybridMs = ms(hybridCache)

    points.push({ x: T, y: mhaMs, series: 'MHA' })
    points.push({ x: T, y: gqaMs, series: 'GQA' })
    points.push({ x: T, y: mlaMs, series: 'MLA' })
    points.push({ x: T, y: deltaMs, series: 'Gated DeltaNet' })
    points.push({ x: T, y: mambaMs, series: 'Mamba-2' })
    points.push({ x: T, y: hybridMs, series: `Mamba-2 / attn ${ratio}:1` })

    if (i === samples - 1) {
      mhaAtMax = mhaMs
      mambaAtMax = mambaMs
      hybridAtMax = hybridMs
    }
  }

  const speedup = mhaAtMax > 0 ? mhaAtMax / mambaAtMax : 0

  return {
    points,
    seriesKeys: ['MHA', 'GQA', 'MLA', 'Gated DeltaNet', 'Mamba-2', `Mamba-2 / attn ${ratio}:1`],
    xDomain: [1024, maxContext],
    annotations: [
      { type: 'hline', y: 1000 / 30, label: '30 tok/s (33 ms)' },
      { type: 'hline', y: 1000 / 5, label: '5 tok/s (200 ms)' },
    ],
    summary: [
      { label: 'Bandwidth', value: `${bandwidthGBs.toFixed(0)} GB/s` },
      { label: 'Weights', value: `${weightGB.toFixed(1)} GB` },
      {
        label: `MHA @ ${maxContext.toLocaleString()}`,
        value: `${mhaAtMax.toFixed(0)} ms (${(1000 / mhaAtMax).toFixed(1)} tok/s)`,
      },
      {
        label: `Mamba-2 @ ${maxContext.toLocaleString()}`,
        value: `${mambaAtMax.toFixed(0)} ms (${(1000 / mambaAtMax).toFixed(1)} tok/s)`,
      },
      {
        label: `Hybrid @ ${maxContext.toLocaleString()}`,
        value: `${hybridAtMax.toFixed(0)} ms (${(1000 / hybridAtMax).toFixed(1)} tok/s)`,
      },
      { label: 'Mamba-2 vs MHA', value: `${speedup.toFixed(1)}× faster` },
    ],
  }
}
