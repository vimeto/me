import { series, seriesOrder, textureIds } from './tokens'

export function VizTextures() {
  return (
    <defs>
      {seriesOrder.map((key) => {
        const s = series[key]
        return (
          <g key={key}>
            <pattern
              id={textureIds.hatch(key)}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill={s.fill} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={s.stroke} strokeWidth="0.9" />
            </pattern>
            <pattern id={textureIds.dots(key)} patternUnits="userSpaceOnUse" width="6" height="6">
              <rect width="6" height="6" fill={s.fill} />
              <circle cx="1.5" cy="1.5" r="0.8" fill={s.stroke} opacity="0.55" />
            </pattern>
            <linearGradient id={textureIds.gradient(key)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.fillStrong} />
              <stop offset="100%" stopColor={s.fill} />
            </linearGradient>
          </g>
        )
      })}
    </defs>
  )
}
