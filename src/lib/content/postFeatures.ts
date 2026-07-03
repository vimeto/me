import features from 'virtual:post-features'

export type PostFeatures = {
  blocks: string[]
  firstPlot: {
    compute: string
    kind: 'line' | 'area' | 'bar'
    params: Record<string, number | string | boolean>
  } | null
  readMin: number
}

export function getFeatures(slug: string): PostFeatures | undefined {
  return (features as Record<string, PostFeatures>)[slug]
}
