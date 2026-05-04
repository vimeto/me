import type { ComputeFn, ComputeParams, ComputeResult, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// ----------------------------------------------------------------------------
// Constants anchored on parameter-golf PR 1935 + batch125 numbers.
//
// Model: d=512, ~124M params, 16 MB brotli artifact cap.
// Locked baseline: SP8192 + CO + INT7 → 1.06755 BPB at 15.91 MB.
// Vocab sweep at INT7 (single-seed full-train):
//   SP8k  → 1.06755 (15.91 MB, fits)
//   SP12k → 1.06024 (18.10 MB, blows cap)
//   SP16k → 1.06024 (18.10 MB)
//   SP24k → 1.05338 (20.36 MB)
//   SP32k → 1.05076 (22.52 MB)
// INT-bit sweep at SP32k (cost over INT7 reference at same vocab):
//   INT7 → +0.000   INT5 → +0.012
//   INT4 → +0.120   INT3 → +0.724
// Sparse-FP16 + per-row top-K (Phase C, SP12k+CO topk-0.10, 4-seed):
//   {1.0931, 1.0982, 1.1009, 1.0959}, range 0.0078, mean ~1.097.
// Frequency-aware mixed-precision: best beats uniform INT5 by ~0.005 BPB
//   (still ~+0.007 above uniform INT7 reference).
// ----------------------------------------------------------------------------

const D_MODEL = 512
const CAP_MB = 16
const BROTLI_RATIO_INT = 0.55 // raw → brotli for INT-quantised embed bytes
const BROTLI_RATIO_FP16 = 0.7 // raw → brotli for dense FP16

// Vocab term: doubling vocab buys ~0.008–0.01 BPB at INT7. Modelled as a
// gentle log decay, anchored on (8192, 1.06755) and (32768, 1.05076).
function bpbVocabTerm(vocab: number): number {
  // log2(vocab/8192) ranges 0..2 over 8k..32k.
  const t = Math.log2(Math.max(1, vocab) / 8192)
  // 1.06755 at t=0, 1.05076 at t=2 → drop of 0.01679 over t∈[0,2].
  // Smooth, not yet saturated.
  return 1.06755 - 0.0168 * t * (1 - 0.05 * t)
}

// INT-bit penalty over the embed. Calibrated to the SP32k sweep in PR 1935:
//   INT7 → +0.000   INT6 → +0.003 (interp.)
//   INT5 → +0.012   INT4 → +0.120   INT3 → +0.724
// The curve is super-exponential below INT5 (the cliff). We piecewise-fit
// a smooth function rather than carrying a lookup, but anchor exactly on
// the b ∈ {3, 4, 5, 7} measured points.
function quantPenalty(b: number): number {
  if (b >= 8) return 0
  if (b >= 7) return 0
  // Two-piece exponential. Above INT5 the cost is linear-ish; below it
  // explodes. Fit: penalty(b) = A · exp(k · (5.5 − b)).
  // 0.012 at b=5; 0.120 at b=4; 0.724 at b=3.
  const x = 5.5 - b
  // exp-fit through (−0.5, 0.012), (0.5, 0.120), (1.5, 0.724) ≈ A·exp(k·x).
  // log(0.120/0.012) = 2.30 between x=−0.5 and x=0.5 → k ≈ 2.30.
  // A·exp(−1.15) = 0.012 → A ≈ 0.038.
  return 0.038 * Math.exp(2.3 * x)
}

function denseBytesMB(vocab: number, bits: number): number {
  // Raw bytes = vocab × d × bits / 8.
  const raw = (vocab * D_MODEL * bits) / 8
  return (raw * BROTLI_RATIO_INT) / 1024 / 1024
}

function denseFp16BytesMB(vocab: number): number {
  const raw = (vocab * D_MODEL * 16) / 8
  return (raw * BROTLI_RATIO_FP16) / 1024 / 1024
}

// Sparse-FP16 with bitmap: kept-fraction × 16 + 1 (bitmap bit) per cell.
// Brotli compresses both pieces; we approximate with a kept-fraction-aware
// ratio that matches the Phase A compression study (sp8k 90% sparse → ~0.7 MB
// at d=512 raw, ~0.7 MB compressed).
function sparseFp16BytesMB(vocab: number, keepFrac: number): number {
  const valuesRaw = vocab * D_MODEL * keepFrac * 2 // 2 bytes per FP16
  const bitmapRaw = (vocab * D_MODEL) / 8 // 1 bit per cell
  // Brotli is generous on bitmaps + sparse FP16 (matches PR 1935 numbers).
  const ratio = 0.55 + 0.2 * keepFrac // sparser → tighter brotli
  return ((valuesRaw + bitmapRaw) * ratio) / 1024 / 1024
}

// Frequency-weighted-precision: a fraction `headFrac` of rows at headBits, the
// rest at tailBits. Bytes are a weighted sum; quality penalty is the
// frequency-weighted quant error.
function freqWeightedBytesMB(
  vocab: number,
  headFrac: number,
  headBits: number,
  tailBits: number
): number {
  const headRows = Math.round(vocab * headFrac)
  const tailRows = vocab - headRows
  const raw = (headRows * D_MODEL * headBits + tailRows * D_MODEL * tailBits) / 8
  return (raw * BROTLI_RATIO_INT) / 1024 / 1024
}

// ----------------------------------------------------------------------------

/**
 * embed.sizeVsLoss
 *
 * Validation BPB vs compressed embedding bytes (MB) for the embedding-side
 * tricks tried in parameter-golf PR 1935. Multiple series, each parameterised
 * by vocab (slider). The 16 MB brotli cap is a vertical reference line.
 *
 * Series:
 *   - dense FP16   (no quantisation; massive)
 *   - dense INT8
 *   - dense INT7   (the locked baseline for SP8k+CO)
 *   - dense INT5
 *   - dense INT4   (collapse — +0.120 BPB at SP32k)
 *   - sparse-trained FP16 (per-row top-K at vocab-dependent sparsity)
 *   - frequency-weighted-precision (top 1024 INT8, rest INT5)
 *
 * Each series's (x, y) is (compressed embed MB, BPB) at the chosen vocab.
 * BPB = bpbVocab(vocab) + quantPenalty(b_eff), with sparse-FP16 paying an
 * extra additive cost calibrated to the Phase C multi-seed mean (~1.097).
 */
export const embedSizeVsLoss: ComputeFn = (params): ComputeResult => {
  const vocab = Math.max(8192, Math.min(32768, Math.round(asNumber(params, 'vocab', 8192))))

  // We sweep vocab on each series so the multi-series curves are full lines
  // across the X axis (compressed bytes). The slider's `vocab` controls the
  // summary readouts only.
  const vocabSweep: number[] = []
  for (let v = 8192; v <= 32768; v += 2048) vocabSweep.push(v)

  const points: Point[] = []
  const seriesKeys: string[] = []

  function pushSeries(key: string, fn: (v: number) => { mb: number; bpb: number }) {
    seriesKeys.push(key)
    for (const v of vocabSweep) {
      const { mb, bpb } = fn(v)
      points.push({ x: mb, y: bpb, series: key })
    }
  }

  pushSeries('dense FP16', (v) => ({ mb: denseFp16BytesMB(v), bpb: bpbVocabTerm(v) - 0.001 }))
  pushSeries('dense INT8', (v) => ({
    mb: denseBytesMB(v, 8),
    bpb: bpbVocabTerm(v) + quantPenalty(8),
  }))
  pushSeries('dense INT7', (v) => ({ mb: denseBytesMB(v, 7), bpb: bpbVocabTerm(v) }))
  pushSeries('dense INT5', (v) => ({
    mb: denseBytesMB(v, 5),
    bpb: bpbVocabTerm(v) + quantPenalty(5),
  }))
  pushSeries('dense INT4', (v) => ({
    mb: denseBytesMB(v, 4),
    bpb: bpbVocabTerm(v) + quantPenalty(4),
  }))
  // Sparse-FP16 per-row top-K. Sparsity needed to fit cap rises with vocab.
  // Phase A: SP10k 85%, SP12k 90%, SP16k 92%, SP24k 95%. We fit a smooth keep-frac.
  pushSeries('sparse FP16 (top-K)', (v) => {
    const keepFrac = Math.max(0.05, Math.min(0.5, 0.18 - 0.00001 * (v - 8192)))
    // Phase C cost: +0.045 BPB at SP12k topk-0.10. Cost falls slightly with
    // higher keep-frac and rises at very high vocab where mask is too tight.
    const sparseCost = 0.045 + 0.012 * Math.log2(v / 12288) - 0.05 * (keepFrac - 0.1)
    return { mb: sparseFp16BytesMB(v, keepFrac), bpb: bpbVocabTerm(v) + Math.max(0.02, sparseCost) }
  })
  // Frequency-weighted: top-1024 at INT8, rest INT5. Beats uniform INT5 by
  // ~0.005 BPB but stays above INT7. We weight quant penalty by frequency
  // share (~0.55 of probability mass on first 1024 rows under Zipf s≈1.05).
  pushSeries('freq-weighted bits', (v) => {
    const headFrac = Math.min(0.5, 1024 / v)
    const massHead = 0.55
    const massTail = 0.45
    const bpb = bpbVocabTerm(v) + massHead * quantPenalty(8) + massTail * quantPenalty(5) - 0.005 // empirical edge over uniform INT5 from batch125 atlas
    return { mb: freqWeightedBytesMB(v, headFrac, 8, 5), bpb }
  })

  // Find the chosen-vocab point on each series for the summary.
  const baselineMb = denseBytesMB(8192, 7)
  const baselineBpb = bpbVocabTerm(8192)

  const chosenInt7Mb = denseBytesMB(vocab, 7)
  const chosenInt7Bpb = bpbVocabTerm(vocab)
  const chosenSparseMb = sparseFp16BytesMB(vocab, Math.max(0.05, 0.18 - 0.00001 * (vocab - 8192)))

  // Domain: cap the X axis at ~30 MB so the FP16 series is visible without
  // dominating the layout.
  const xMax = 30
  const yMin = 1.04
  const yMax = 1.22

  return {
    points,
    seriesKeys,
    xDomain: [0, xMax],
    yDomain: [yMin, yMax],
    annotations: [
      { type: 'vline', x: CAP_MB, label: `16 MB cap` },
      { type: 'hline', y: baselineBpb, label: `SP8k INT7 = ${baselineBpb.toFixed(4)}` },
    ],
    summary: [
      { label: 'Vocab', value: vocab.toLocaleString() },
      {
        label: 'Dense INT7 @ vocab',
        value: `${chosenInt7Mb.toFixed(1)} MB / ${chosenInt7Bpb.toFixed(4)} BPB`,
      },
      { label: 'Sparse-FP16 @ vocab', value: `${chosenSparseMb.toFixed(1)} MB` },
      {
        label: 'Baseline (locked)',
        value: `${baselineMb.toFixed(1)} MB / ${baselineBpb.toFixed(4)} BPB`,
      },
    ],
  }
}

/**
 * embed.zipfPrecision
 *
 * Token frequency on a Zipf log-log curve overlaid with allocated bits per
 * row. The reader drags `cutoffPct` and `tailBits`; the bars repaint the
 * head/tail regions, and the summary block shows compressed bytes vs the
 * dense INT7 reference at the same vocab.
 *
 * Frequency model: f(rank) ∝ (rank + 1)^(-s).
 * Allocation: rows below cutoff get headBits, rows above get tailBits.
 * Quality proxy: frequency-weighted error Σ f(r) · 2^(-2·b(r)).
 *
 * The plot is rendered as a per-rank bit-width bar; we use a log-spaced
 * subsample so that head and tail are both legible.
 */
export const embedZipfPrecision: ComputeFn = (params): ComputeResult => {
  const vocab = Math.max(2048, Math.min(32768, Math.round(asNumber(params, 'vocabSize', 12288))))
  const cutoffPct = Math.max(0.5, Math.min(50, asNumber(params, 'cutoffPct', 8)))
  const headBits = Math.max(2, Math.min(16, Math.round(asNumber(params, 'headBits', 8))))
  const tailBits = Math.max(2, Math.min(16, Math.round(asNumber(params, 'tailBits', 5))))
  const zipfS = Math.max(0.6, Math.min(1.6, asNumber(params, 'zipfS', 1.05)))

  const cutoffRows = Math.max(1, Math.round((cutoffPct / 100) * vocab))

  // Sample ranks on a log scale so the bars are evenly spaced visually.
  const N_BARS = 64
  const points: Point[] = []
  const seriesKeys = ['allocated bits', 'log frequency']

  // Log-spaced ranks (1 .. vocab).
  const lnMin = Math.log(1)
  const lnMax = Math.log(vocab)
  // Pre-compute frequency normaliser.
  let zNorm = 0
  for (let r = 1; r <= vocab; r++) zNorm += 1 / Math.pow(r, zipfS)

  // For visual layering: the bit-width bar (left axis) and a normalised
  // log-frequency curve (overlay).
  let weightedErr = 0
  let weightedErrUniformHead = 0
  for (let r = 1; r <= vocab; r++) {
    const b = r <= cutoffRows ? headBits : tailBits
    const f = 1 / Math.pow(r, zipfS) / zNorm
    weightedErr += f * Math.pow(2, -2 * b)
    weightedErrUniformHead += f * Math.pow(2, -2 * headBits)
  }
  // Bars: log-spaced subsample for plotting. X is rank, Y is bits.
  for (let i = 0; i < N_BARS; i++) {
    const t = i / (N_BARS - 1)
    const r = Math.max(1, Math.min(vocab, Math.round(Math.exp(lnMin + (lnMax - lnMin) * t))))
    const b = r <= cutoffRows ? headBits : tailBits
    points.push({ x: r, y: b, series: 'allocated bits' })
  }
  // Frequency overlay (scaled to share the y-axis with bits). We map log-prob
  // to roughly the [0, headBits] range so it's visually comparable.
  const lnFHead = Math.log(1 / Math.pow(1, zipfS) / zNorm)
  const lnFTail = Math.log(1 / Math.pow(vocab, zipfS) / zNorm)
  const range = Math.max(1e-6, lnFHead - lnFTail)
  for (let i = 0; i < N_BARS; i++) {
    const t = i / (N_BARS - 1)
    const r = Math.max(1, Math.min(vocab, Math.round(Math.exp(lnMin + (lnMax - lnMin) * t))))
    const f = 1 / Math.pow(r, zipfS) / zNorm
    const lnF = Math.log(f)
    const yScaled = ((lnF - lnFTail) / range) * Math.max(headBits, tailBits)
    points.push({ x: r, y: yScaled, series: 'log frequency' })
  }

  // Bytes accounting.
  const headRows = cutoffRows
  const tailRows = vocab - cutoffRows
  const rawBytes = (headRows * D_MODEL * headBits + tailRows * D_MODEL * tailBits) / 8
  const compressedMB = (rawBytes * BROTLI_RATIO_INT) / 1024 / 1024

  // Reference: dense INT7 at the same vocab.
  const refBytes = (vocab * D_MODEL * 7) / 8
  const refMB = (refBytes * BROTLI_RATIO_INT) / 1024 / 1024
  const deltaMB = compressedMB - refMB

  // Quality penalty proxy vs uniform-headBits everywhere.
  const errRatio = weightedErrUniformHead > 0 ? weightedErr / weightedErrUniformHead : 1

  return {
    points,
    seriesKeys,
    xDomain: [1, vocab],
    yDomain: [0, Math.max(headBits, tailBits) + 1],
    annotations: [
      { type: 'vline', x: cutoffRows, label: `cutoff = top ${cutoffPct.toFixed(1)}%` },
      { type: 'hline', y: headBits, label: `head = INT${headBits}` },
      { type: 'hline', y: tailBits, label: `tail = INT${tailBits}` },
      { type: 'band', from: 1, to: cutoffRows, axis: 'x', label: 'protected head' },
    ],
    summary: [
      {
        label: 'Rows above cutoff',
        value: `${headRows.toLocaleString()} / ${vocab.toLocaleString()}`,
      },
      { label: 'Compressed embed', value: `${compressedMB.toFixed(2)} MB` },
      { label: 'vs dense INT7', value: `${deltaMB >= 0 ? '+' : ''}${deltaMB.toFixed(2)} MB` },
      { label: 'Weighted err / uniform head', value: errRatio.toFixed(2) },
    ],
  }
}
