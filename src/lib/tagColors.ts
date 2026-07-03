import { series, type SeriesKey, type SeriesTheme } from '@/components/mdx/theme/tokens'

// Color carries information here: each top-level tag family gets a fixed hue from
// the series palette so a post's subject is legible at a glance. Ochre (--ink)
// stays the site-wide accent; these hues are strictly for the tag families.
const familyToSeries: Record<string, SeriesKey> = {
  'language-models': 'teal',
  'ml-systems': 'violet',
  math: 'amber',
  optimization: 'magenta',
  'lab-notes': 'lime',
}

export function familyColorOf(topLevelTag: string): SeriesKey {
  return familyToSeries[topLevelTag] ?? 'teal'
}

export function familyTheme(topLevelTag: string): SeriesTheme {
  return series[familyColorOf(topLevelTag)]
}
