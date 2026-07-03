import type { ComputeFn, ComputeParams, Point } from './types'

function asNumber(p: ComputeParams, key: string, fallback: number): number {
  const v = p[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Curves for the "Teaching a language model to think in Finnish" post.
 *
 * These are illustrative renderings of real training runs, pinned to the
 * verified numbers in grpo_collaborative/reports (miettija_dlc.md,
 * miettija_reasoning_creation.md): measured start rates, engagement and
 * saturation steps, peak/collapse checkpoints. Between the measured anchor
 * points the shape is smoothly interpolated — the phenomena (fixed point at
 * 0%, threshold engagement, bootstrap crossing, late collapse) are the data's.
 */

// Smoothstep between two x positions.
function rise(x: number, from: number, to: number): number {
  if (x <= from) return 0
  if (x >= to) return 1
  const t = (x - from) / (to - from)
  return t * t * (3 - 2 * t)
}

/**
 * Base-rate sweep: Finnish-thinking fraction during penalty-only RL, by
 * warm-start base rate. Measured: 0% stays exactly 0 (group-norm cancellation;
 * confirmed through step 400); 25% starts ~0.22, engages ~step 26, saturates
 * ~1.0 by step 41; 50% starts ~0.47, same engagement; 100% holds ~1.0.
 */
export const miettijaBaseRate: ComputeFn = (params) => {
  const ratePct = Math.max(0, Math.min(100, asNumber(params, 'baseRatePct', 25)))
  const rate = ratePct / 100

  const points: Point[] = []
  const engage = 26
  // Larger seeds converge slightly faster (measured: both 25% and 50% land by ~41).
  const saturate = 41 - rate * 3

  for (let step = 0; step <= 80; step += 2) {
    let y: number
    if (ratePct === 0) {
      y = 0
    } else if (ratePct === 100) {
      y = 0.99
    } else {
      // Measured starts sit a hair under the nominal mix (0.25 → 0.22, 0.50 → 0.47).
      const start = Math.max(0, rate - 0.03)
      y = start + (1 - start) * rise(step, engage, saturate)
      y = Math.min(1, y)
    }
    points.push({ x: step, y })
  }

  const annotations: NonNullable<ReturnType<ComputeFn>['annotations']> = []
  if (ratePct > 0 && ratePct < 100) {
    annotations.push({ type: 'vline', x: engage, label: 'penalty engages' })
  }

  return {
    points,
    annotations,
    xDomain: [0, 80],
    yDomain: [0, 1],
    summary: [
      {
        label: 'saturation',
        value:
          ratePct === 0
            ? 'never (0% is a fixed point)'
            : ratePct === 100
              ? 'already saturated'
              : `~step ${Math.round(saturate)}`,
      },
    ],
  }
}

/**
 * Bootstrap from a 0% warm-start: naive penalty vs penalty + decoupled
 * supervised anchor (four examples per step). Measured lang_ok (w0.3):
 * 0.00 through step 20, 0.88 at 40, noisy 0.62 at 45 (8 rollouts/step),
 * 1.00 by 60 and stable after; naive control flat 0.00 through step 400.
 */
export const miettijaBootstrap: ComputeFn = (params) => {
  const anchored = asNumber(params, 'anchor', 1) >= 0.5

  // Measured + interpolated trajectory; the dip at 45 is in the logs (the
  // per-step signal is only 8 rollouts, so mid-crossing steps are noisy).
  const anchoredCurve: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [20, 0],
    [25, 0.02],
    [30, 0.15],
    [35, 0.42],
    [40, 0.88],
    [45, 0.62],
    [50, 0.86],
    [55, 0.97],
    [60, 1.0],
    [70, 0.99],
    [80, 1.0],
    [90, 1.0],
    [100, 1.0],
  ]

  const points: Point[] = anchored
    ? anchoredCurve.map(([x, y]) => ({ x, y }))
    : Array.from({ length: 21 }, (_, i) => ({ x: i * 5, y: 0 }))

  return {
    points,
    annotations: anchored ? [{ type: 'band', from: 35, to: 55, axis: 'x' }] : [],
    xDomain: [0, 100],
    yDomain: [0, 1],
    summary: [
      {
        label: 'held-out Finnish @ckpt-100',
        value: anchored ? '0.94 ± 0.02 (n=3)' : '0.04',
      },
      {
        label: 'held-out accuracy',
        value: anchored ? '0.80' : '0.83',
      },
    ],
  }
}

/**
 * Long-run RL, held-out accuracy by checkpoint: unprotected vs anchored
 * (one run each). Measured: both start from the 0.28 SFT model; naive peaks
 * 0.404 at ckpt-200 then craters to 0.052 by ckpt-450 (completions shrivel to
 * ~131 chars); anchored holds 0.392 / 0.400 / 0.396 / 0.364 at
 * ckpt-200/250/400/450 with ~1206-char reasoning.
 */
export const miettijaCollapse: ComputeFn = (params) => {
  const anchored = asNumber(params, 'anchored', 1) >= 0.5

  const naive: Array<[number, number]> = [
    [0, 0.28],
    [50, 0.33],
    [100, 0.37],
    [150, 0.395],
    [200, 0.404],
    [250, 0.34],
    [300, 0.24],
    [350, 0.15],
    [400, 0.09],
    [450, 0.052],
  ]
  const dlc: Array<[number, number]> = [
    [0, 0.28],
    [50, 0.32],
    [100, 0.36],
    [150, 0.38],
    [200, 0.392],
    [250, 0.4],
    [300, 0.398],
    [350, 0.397],
    [400, 0.396],
    [450, 0.364],
  ]

  const curve = anchored ? dlc : naive
  const points: Point[] = curve.map(([x, y]) => ({ x, y }))

  return {
    points,
    annotations: [{ type: 'vline', x: 200, label: anchored ? 'ckpt-200' : 'peak 0.404' }],
    xDomain: [0, 450],
    yDomain: [0, 0.45],
    summary: [
      { label: 'held-out acc @ckpt-450', value: anchored ? '0.364' : '0.052' },
      { label: 'avg completion @ckpt-450', value: anchored ? '1206 chars' : '131 chars' },
    ],
  }
}
