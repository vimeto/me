export type SeriesKey = 'teal' | 'amber' | 'magenta' | 'lime' | 'violet' | 'coral'

export type SeriesTheme = {
  fill: string
  fillStrong: string
  stroke: string
  text: string
}

// Text tokens are driven by CSS custom properties so dark mode swaps to the
// brighter variant (see :root vs .dark blocks in index.css). Fills and strokes
// stay literal — their alpha-softened / saturated hues read well on both
// backgrounds.
export const series: Record<SeriesKey, SeriesTheme> = {
  teal: {
    fill: 'rgb(45 212 191 / 0.22)',
    fillStrong: 'rgb(45 212 191 / 0.45)',
    stroke: 'rgb(13 148 136)',
    text: 'rgb(var(--s-teal-text))',
  },
  amber: {
    fill: 'rgb(251 191 36 / 0.22)',
    fillStrong: 'rgb(251 191 36 / 0.5)',
    stroke: 'rgb(217 119 6)',
    text: 'rgb(var(--s-amber-text))',
  },
  magenta: {
    fill: 'rgb(232 121 198 / 0.22)',
    fillStrong: 'rgb(232 121 198 / 0.5)',
    stroke: 'rgb(192 38 137)',
    text: 'rgb(var(--s-magenta-text))',
  },
  lime: {
    fill: 'rgb(163 230 53 / 0.22)',
    fillStrong: 'rgb(163 230 53 / 0.5)',
    stroke: 'rgb(101 163 13)',
    text: 'rgb(var(--s-lime-text))',
  },
  violet: {
    fill: 'rgb(167 139 250 / 0.22)',
    fillStrong: 'rgb(167 139 250 / 0.5)',
    stroke: 'rgb(124 58 237)',
    text: 'rgb(var(--s-violet-text))',
  },
  coral: {
    fill: 'rgb(251 113 133 / 0.22)',
    fillStrong: 'rgb(251 113 133 / 0.5)',
    stroke: 'rgb(225 29 72)',
    text: 'rgb(var(--s-coral-text))',
  },
}

export const seriesOrder: SeriesKey[] = ['teal', 'amber', 'magenta', 'lime', 'violet', 'coral']

export function seriesAt(i: number): SeriesTheme {
  return series[seriesOrder[i % seriesOrder.length]]
}

export const motion = {
  // Spring-ish easing that feels lively but not bouncy.
  ease: [0.22, 1, 0.36, 1] as const,
  durationFast: 0.18,
  durationBase: 0.32,
}

export const plotChrome = {
  axis: 'rgb(var(--border) / 0.8)',
  axisLabel: 'rgb(var(--muted-foreground))',
  grid: 'rgb(var(--border) / 0.25)',
  surface: 'rgb(var(--card))',
}

export const textureIds = {
  // Consumers render <VizTextures /> once per Plot; patterns reference these ids.
  hatch: (key: SeriesKey) => `viz-hatch-${key}`,
  dots: (key: SeriesKey) => `viz-dots-${key}`,
  gradient: (key: SeriesKey) => `viz-gradient-${key}`,
}
