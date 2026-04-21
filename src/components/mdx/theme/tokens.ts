export type SeriesKey = 'teal' | 'amber' | 'magenta' | 'lime' | 'violet' | 'coral'

export type SeriesTheme = {
  fill: string
  fillStrong: string
  stroke: string
  text: string
}

export const series: Record<SeriesKey, SeriesTheme> = {
  teal: {
    fill: 'rgb(45 212 191 / 0.22)',
    fillStrong: 'rgb(45 212 191 / 0.45)',
    stroke: 'rgb(13 148 136)',
    text: 'rgb(15 118 110)',
  },
  amber: {
    fill: 'rgb(251 191 36 / 0.22)',
    fillStrong: 'rgb(251 191 36 / 0.5)',
    stroke: 'rgb(217 119 6)',
    text: 'rgb(180 83 9)',
  },
  magenta: {
    fill: 'rgb(232 121 198 / 0.22)',
    fillStrong: 'rgb(232 121 198 / 0.5)',
    stroke: 'rgb(192 38 137)',
    text: 'rgb(157 23 105)',
  },
  lime: {
    fill: 'rgb(163 230 53 / 0.22)',
    fillStrong: 'rgb(163 230 53 / 0.5)',
    stroke: 'rgb(101 163 13)',
    text: 'rgb(77 124 15)',
  },
  violet: {
    fill: 'rgb(167 139 250 / 0.22)',
    fillStrong: 'rgb(167 139 250 / 0.5)',
    stroke: 'rgb(124 58 237)',
    text: 'rgb(91 33 182)',
  },
  coral: {
    fill: 'rgb(251 113 133 / 0.22)',
    fillStrong: 'rgb(251 113 133 / 0.5)',
    stroke: 'rgb(225 29 72)',
    text: 'rgb(190 18 60)',
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
