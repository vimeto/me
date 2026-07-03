import type { CSSProperties } from 'react'
import { familyTheme } from '@/lib/tagColors'

type Props = {
  label: string
  count?: number
  active: boolean
  onClick: () => void
  /** Optional top-level tag family; when set the chip is tinted with its hue. */
  family?: string
}

// Reduce a literal `rgb(r g b)` token to a softer border alpha.
function softBorder(stroke: string): string {
  return stroke.replace(/\)\s*$/, ' / 0.45)')
}

export function FilterChip({ label, count, active, onClick, family }: Props) {
  const theme = family ? familyTheme(family) : undefined

  // Border width never changes (always 1px); the "selected" weight comes from an
  // inset box-shadow, so nothing reflows between states. Square corners.
  const style: CSSProperties = {}
  if (theme) {
    style.color = theme.text
    style.borderColor = softBorder(theme.stroke)
    if (active) style.background = theme.fill
  }
  if (active) {
    style.boxShadow = 'inset 0 0 0 1px currentColor'
  }

  const colorClass = theme ? '' : active ? 'text-foreground' : 'text-muted-foreground'

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`text-sm px-3 py-1 border border-border transition-colors ${colorClass}`}
    >
      {label}
      {typeof count === 'number' && (
        <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  )
}
