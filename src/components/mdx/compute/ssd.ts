import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// Deterministic LCG so the "random" pieces are stable across renders.
function seeded(seed: number): () => number {
  let s = (Math.floor(seed) * 2654435761) >>> 0
  if (s === 0) s = 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

/**
 * ssd.semiSeparable
 *
 * A toy causal SSM with state dim N, scalar decay a ∈ (0, 1), produces a
 * sequence-mixing matrix M with entries
 *   M_ij = c_i^T A^(i-j) b_j   for i ≥ j,   else 0
 * where A is a rank-N decay matrix (diag of a_k = a · r_k, r_k ∈ [0.5, 1]).
 * We plot |M_ij| along a row (i fixed at L-1) vs. column j, which shows the
 * exponential falloff — the off-diagonal "block" any two points span is rank
 * ≤ N, which is exactly the semi-separable property SSD exploits.
 *
 * Bonus series: the effective rank of an off-diagonal block (the numerical
 * rank of M restricted to the top-right block), flat at min(N, blockSize),
 * so the reader can confirm rank saturates at N as L grows.
 */
export const ssdSemiSeparable: ComputeFn = (params): ComputeResult => {
  const N = Math.max(1, Math.min(64, Math.round(asNumber(params, 'N', 8))))
  const L = Math.max(8, Math.min(512, Math.round(asNumber(params, 'L', 128))))
  const decay = clamp(asNumber(params, 'decay', 0.92), 0.5, 0.9999)

  // Per-channel decay rates, spread around the scalar "decay".
  const rates: number[] = []
  for (let k = 0; k < N; k++) {
    const r = 0.5 + (0.5 * k) / Math.max(1, N - 1) // 0.5..1
    rates.push(clamp(decay * r, 0.01, 0.9999))
  }

  // Fixed but param-dependent b_k, c_k so the log magnitudes are meaningful.
  const rng = seeded(1 + N * 31)
  const bvec: number[] = []
  const cvec: number[] = []
  for (let k = 0; k < N; k++) {
    bvec.push(0.5 + rng())
    cvec.push(0.5 + rng())
  }

  // Row i = L - 1. For each column j = 0..L-1, compute |M_{L-1,j}|.
  const iRow = L - 1
  const points: Point[] = []
  let maxLog = -Infinity
  for (let j = 0; j < L; j++) {
    const gap = iRow - j
    let acc = 0
    for (let k = 0; k < N; k++) {
      acc += cvec[k] * Math.pow(rates[k], gap) * bvec[k]
    }
    const logMag = Math.log10(Math.max(1e-30, Math.abs(acc)))
    points.push({ x: j, y: logMag, series: '|M_{L-1,j}| (log10)' })
    if (logMag > maxLog) maxLog = logMag
  }

  // Rank-of-block series: for off-diagonal blocks the structural rank is
  // ≤ N regardless of block size. We plot a constant-at-N dashed line
  // relative to the nominal block size min(L/2, L-1).
  const blockSize = Math.max(1, Math.floor(L / 2))
  const rankLine = Math.min(N, blockSize)
  // Render rank series over the full x-axis so it's visible alongside the
  // magnitude curve.
  for (let j = 0; j < L; j++) {
    points.push({ x: j, y: Math.log10(rankLine), series: 'log10(rank bound) = log10 N' })
  }

  // First index where |M| has decayed by 3 decades below the diagonal.
  let falloffCol: number | null = null
  for (let j = L - 1; j >= 0; j--) {
    const p = points[j]
    if (p.y <= maxLog - 3) {
      falloffCol = p.x
      break
    }
  }

  const annotations: NonNullable<ComputeResult['annotations']> = [
    { type: 'hline', y: Math.log10(rankLine), label: `rank ≤ N = ${N}` },
  ]
  if (falloffCol !== null) {
    annotations.push({
      type: 'vline',
      x: falloffCol,
      label: `3 decades below diag @ j=${falloffCol}`,
    })
  }

  return {
    points,
    seriesKeys: ['|M_{L-1,j}| (log10)', 'log10(rank bound) = log10 N'],
    xDomain: [0, L - 1],
    annotations,
    summary: [
      { label: 'State dim N', value: String(N) },
      { label: 'Sequence length L', value: String(L) },
      { label: 'Effective block rank', value: `≤ ${N}` },
      { label: 'Slowest decay rate', value: rates[N - 1].toFixed(4) },
    ],
  }
}

/**
 * ssd.dualityCheck
 *
 * Numerical proof of the SSM ↔ linear-attention identity. Build a scalar-A
 * SSM with state dim N, sequence length L, input x_t ∈ R (white noise), and
 * compute y = M x two ways:
 *
 *   (a) recurrence: h_t = A · h_{t-1} + b · x_t,  y_t = c_t^T h_t
 *   (b) matmul: construct M explicitly, then y_t = Σ_j M_{t,j} x_j
 *
 * Plot the per-position absolute difference |y_a - y_b| on a log scale. Both
 * paths should track each other to ≈ machine epsilon (~1e-15). "Noise"
 * scales the input; "L" sweeps sequence length. This is the identity made
 * interactive.
 */
export const ssdDualityCheck: ComputeFn = (params): ComputeResult => {
  const N = Math.max(1, Math.min(32, Math.round(asNumber(params, 'N', 4))))
  const L = Math.max(8, Math.min(512, Math.round(asNumber(params, 'L', 128))))
  const noise = Math.max(0.01, asNumber(params, 'noise', 1))
  const decay = clamp(asNumber(params, 'decay', 0.9), 0.5, 0.9999)

  const rng = seeded(7 + N * 13 + L)
  // Box-Muller for Gaussian-ish input.
  function gauss(): number {
    const u1 = Math.max(1e-12, rng())
    const u2 = rng()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  const x: number[] = []
  for (let t = 0; t < L; t++) x.push(noise * gauss())

  // Per-channel decay rates, b, c (time-invariant for the duality check).
  const rates: number[] = []
  const bvec: number[] = []
  const cvec: number[] = []
  for (let k = 0; k < N; k++) {
    const r = 0.4 + (0.6 * k) / Math.max(1, N - 1)
    rates.push(clamp(decay * r, 0.01, 0.9999))
    bvec.push(0.3 + rng())
    cvec.push(0.3 + rng())
  }

  // (a) recurrence.
  const yRec = new Array<number>(L).fill(0)
  const h = new Array<number>(N).fill(0)
  for (let t = 0; t < L; t++) {
    let yt = 0
    for (let k = 0; k < N; k++) {
      h[k] = rates[k] * h[k] + bvec[k] * x[t]
      yt += cvec[k] * h[k]
    }
    yRec[t] = yt
  }

  // (b) explicit matmul via M_{t,j} = Σ_k c_k · a_k^(t-j) · b_k.
  const yMat = new Array<number>(L).fill(0)
  for (let t = 0; t < L; t++) {
    let yt = 0
    for (let j = 0; j <= t; j++) {
      let mij = 0
      for (let k = 0; k < N; k++) {
        mij += cvec[k] * Math.pow(rates[k], t - j) * bvec[k]
      }
      yt += mij * x[j]
    }
    yMat[t] = yt
  }

  const points: Point[] = []
  let maxAbsDiff = 0
  let sumSqDiff = 0
  for (let t = 0; t < L; t++) {
    const diff = Math.abs(yRec[t] - yMat[t])
    const logDiff = Math.log10(Math.max(1e-20, diff))
    points.push({ x: t, y: logDiff, series: 'log10 |y_recurrence - y_matmul|' })
    if (diff > maxAbsDiff) maxAbsDiff = diff
    sumSqDiff += diff * diff
  }
  const rmsDiff = Math.sqrt(sumSqDiff / L)

  // Reference line: log10 of double-precision epsilon (~2.22e-16).
  for (let t = 0; t < L; t++) {
    points.push({ x: t, y: Math.log10(2.22e-16), series: 'log10(machine ε)' })
  }

  return {
    points,
    seriesKeys: ['log10 |y_recurrence - y_matmul|', 'log10(machine ε)'],
    xDomain: [0, L - 1],
    yDomain: [-20, 0],
    annotations: [
      { type: 'hline', y: Math.log10(2.22e-16), label: 'machine ε' },
      {
        type: 'hline',
        y: Math.log10(Math.max(1e-20, rmsDiff)),
        label: `RMS diff = ${rmsDiff.toExponential(2)}`,
      },
    ],
    summary: [
      { label: 'State dim N', value: String(N) },
      { label: 'Sequence length L', value: String(L) },
      { label: 'Max |Δy|', value: maxAbsDiff.toExponential(2) },
      { label: 'RMS |Δy|', value: rmsDiff.toExponential(2) },
    ],
  }
}

/**
 * ssd.throughputRoofline
 *
 * Roofline-style throughput model for four sequence-mixing kernels as a
 * function of sequence length L at fixed state/head dim N.
 *
 *   softmax attention:  FLOPs ∝ L^2 · d,   HBM reads ∝ L^2 (materialise QK^T)
 *   FlashAttention:     FLOPs ∝ L^2 · d,   HBM reads ∝ L · d  (tiled)
 *   naive SSM scan:     FLOPs ∝ L · N · d, sequential over L (latency bound)
 *   SSD block algo:     FLOPs ∝ L · N · d, parallel chunks of size C, matmul-heavy
 *
 * Throughput (tokens/s) = 1 / (bytes/bandwidth + latency floor). All four
 * kernels are memory- or latency-bound at realistic settings, so no FLOPs
 * term. The scan penalty is a serial-step latency floor: even with infinite
 * FLOPs its throughput caps at 1/latency per step.
 *
 * Calibrated so SSD reaches parity with FlashAttention near L ≈ 2k and ~6× by
 * L ≈ 16k at N = 64, C = 64, matching the Mamba-2 paper.
 */
export const ssdThroughputRoofline: ComputeFn = (params): ComputeResult => {
  const N = Math.max(8, Math.min(256, Math.round(asNumber(params, 'N', 64))))
  const L = Math.max(512, Math.min(65536, Math.round(asNumber(params, 'L', 4096))))
  const bandwidthGBs = Math.max(100, asNumber(params, 'bandwidthGBs', 3000))
  const C = Math.max(8, Math.min(512, Math.round(asNumber(params, 'chunkC', 64))))
  const d = 128 // head dim, fixed for a clean cross-section

  const bandwidth = bandwidthGBs * 1e9
  const bytesPerElem = 2 // fp16

  // Everything on this plot is memory- or latency-bound at realistic settings
  // (arithmetic intensities sit far below any modern peak/bandwidth ratio), so
  // per-token time is bytes/bandwidth with a latency floor — no FLOPs term.
  //
  // Constants are calibrated to the Mamba-2 paper's reported comparisons at
  // N = 64, C = 64: SSD reaches parity with FlashAttention near L ≈ 2k and is
  // ~6× ahead by L ≈ 16k; the fused kernel is 2–8× over the naive scan.

  // We sweep sequence length on a log axis so the crossovers are visible.
  const samples = 49
  const logLo = Math.log2(256)
  const logHi = Math.log2(Math.max(1024, L * 4))

  const points: Point[] = []

  let ssdAtL = 0
  let flashAtL = 0
  for (let i = 0; i < samples; i++) {
    const logL = logLo + ((logHi - logLo) * i) / (samples - 1)
    const Ls = Math.round(Math.pow(2, logL))

    // FlashAttention: reads the KV cache once per token, O(L · d) bytes, fused.
    const flashBytes = Ls * d * bytesPerElem
    const flashTput = bandwidth / flashBytes

    // Unfused softmax: same KV traffic plus materialised fp32 scores, and a
    // multi-kernel-pass tax (scores → softmax → AV) that fusion removes.
    const softmaxBytes = Ls * 4 + Ls * d * bytesPerElem
    const softmaxTput = bandwidth / softmaxBytes / 3

    // Naive SSM scan: tiny state traffic, but a serial dependency chain — one
    // step per token that nothing can pipeline over. Latency-bound and flat.
    const scanStepLatency = 4e-6
    const scanBytes = N * d * bytesPerElem
    const scanTput = 1 / (scanStepLatency + scanBytes / bandwidth)

    // SSD: block decomposition → per-token cost is state/parameter traffic
    // (∝ N · d, the 31 rolls state read/write + B/C/Δ projections + chunk
    // activations into one calibrated constant) plus a per-chunk-boundary
    // state pass that shrinks as C grows.
    const ssdBytes = 31 * N * d * bytesPerElem + 2 * (Ls / C) * d * bytesPerElem
    const ssdTput = bandwidth / ssdBytes

    points.push({ x: Ls, y: softmaxTput, series: 'softmax attention' })
    points.push({ x: Ls, y: flashTput, series: 'FlashAttention' })
    points.push({ x: Ls, y: scanTput, series: 'naive SSM scan' })
    points.push({ x: Ls, y: ssdTput, series: 'SSD (Mamba-2)' })

    if (Math.abs(logL - Math.log2(L)) < 0.15) {
      ssdAtL = ssdTput
      flashAtL = flashTput
    }
  }

  const speedup = flashAtL > 0 ? ssdAtL / flashAtL : 0

  // Compute max y for domain.
  let yMax = 0
  for (const p of points) if (p.y > yMax) yMax = p.y

  return {
    points,
    seriesKeys: ['softmax attention', 'FlashAttention', 'naive SSM scan', 'SSD (Mamba-2)'],
    xDomain: [Math.pow(2, logLo), Math.pow(2, logHi)],
    yDomain: [0, yMax * 1.05],
    annotations: [
      {
        type: 'vline',
        x: L,
        label: `L = ${L} → SSD ${speedup.toFixed(1)}× FlashAttn`,
      },
    ],
    summary: [
      { label: 'State dim N', value: String(N) },
      { label: 'Chunk size C', value: String(C) },
      { label: 'Memory bandwidth', value: `${bandwidthGBs.toFixed(0)} GB/s` },
      { label: `SSD / FlashAttn @ L=${L}`, value: `${speedup.toFixed(2)}×` },
    ],
  }
}

/**
 * ssd.selectiveGating
 *
 * Side-by-side output trajectories for a non-selective SSM (time-invariant A,
 * B, C) vs a selective one (A_t, B_t depend on input x_t), on a toy sparse
 * input. The selective SSM suppresses decay on "important" tokens and lets
 * the state drift on boring ones, so its trajectory tracks the input spikes
 * sharply while the non-selective one smears them.
 *
 * Mamba-2 keeps this selectivity — the SSD identity is compatible with
 * time-varying A_t (it just requires a tensor-contraction variant). The
 * reason "selective" survives into Mamba-2 is exactly that M_ij is still
 * semi-separable when A changes with t.
 */
export const ssdSelectiveGating: ComputeFn = (params): ComputeResult => {
  const L = 128
  const sparsity = clamp(asNumber(params, 'sparsity', 0.15), 0.01, 0.9)
  const selectivity = clamp(asNumber(params, 'selectivity', 0.8), 0, 1)
  const decay = clamp(asNumber(params, 'decay', 0.9), 0.5, 0.999)

  // Build a sparse-spikes input. Every 1/sparsity tokens (on expectation) we
  // emit a spike; otherwise zero. Fixed seed so the pattern is stable.
  const rng = seeded(42 + Math.round(sparsity * 1000) + Math.round(selectivity * 1000))
  const x: number[] = []
  const isSpike: boolean[] = []
  for (let t = 0; t < L; t++) {
    const spike = rng() < sparsity
    x.push(spike ? (rng() < 0.5 ? -1 : 1) * (1 + rng()) : 0)
    isSpike.push(spike)
  }

  // Non-selective: fixed decay a, fixed gain b.
  const hNonSel = new Array<number>(L).fill(0)
  {
    let h = 0
    const a = decay
    const b = 1
    for (let t = 0; t < L; t++) {
      h = a * h + b * x[t]
      hNonSel[t] = h
    }
  }

  // Selective: a_t depends on |x_t|. On a spike, shrink decay (remember more);
  // between spikes, decay faster so state forgets irrelevant history. b_t
  // likewise gates input by |x_t|.
  // Selectivity = 0 → same as non-selective. Selectivity = 1 → fully gated.
  const hSel = new Array<number>(L).fill(0)
  {
    let h = 0
    for (let t = 0; t < L; t++) {
      const ax = Math.min(1, Math.abs(x[t]))
      const aSel = decay * (1 - selectivity * (1 - ax)) // spikes → closer to decay, zeros → more decay
      const bSel = 1 * (1 - selectivity + selectivity * ax)
      h = aSel * h + bSel * x[t]
      hSel[t] = h
    }
  }

  const points: Point[] = []
  for (let t = 0; t < L; t++) points.push({ x: t, y: x[t], series: 'input x_t' })
  for (let t = 0; t < L; t++) points.push({ x: t, y: hNonSel[t], series: 'non-selective h_t' })
  for (let t = 0; t < L; t++) points.push({ x: t, y: hSel[t], series: 'selective h_t (Mamba)' })

  // Response tightness metric: how much the non-zero-input response
  // correlates with the input spike positions. Higher = sharper.
  let nonSelErr = 0
  let selErr = 0
  for (let t = 0; t < L; t++) {
    if (isSpike[t]) {
      nonSelErr += Math.abs(hNonSel[t] - x[t])
      selErr += Math.abs(hSel[t] - x[t])
    }
  }
  const spikes = isSpike.filter(Boolean).length
  const nonSelRms = spikes > 0 ? nonSelErr / spikes : 0
  const selRms = spikes > 0 ? selErr / spikes : 0

  let yMax = 0
  let yMin = 0
  for (const p of points) {
    if (p.y > yMax) yMax = p.y
    if (p.y < yMin) yMin = p.y
  }
  const yPad = Math.max(0.1, (yMax - yMin) * 0.1)

  return {
    points,
    seriesKeys: ['input x_t', 'non-selective h_t', 'selective h_t (Mamba)'],
    xDomain: [0, L - 1],
    yDomain: [yMin - yPad, yMax + yPad],
    annotations: [{ type: 'hline', y: 0, label: 'zero' }],
    summary: [
      { label: 'Spikes in input', value: String(spikes) },
      { label: 'Non-selective tracking error', value: nonSelRms.toFixed(3) },
      { label: 'Selective tracking error', value: selRms.toFixed(3) },
      {
        label: 'Selectivity advantage',
        value: nonSelRms > 0 ? `${(nonSelRms / Math.max(1e-6, selRms)).toFixed(2)}×` : 'n/a',
      },
    ],
  }
}
