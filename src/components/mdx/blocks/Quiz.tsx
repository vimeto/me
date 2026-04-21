import { useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { QuizProps } from '@/schemas/blocks'
import { series, motion as motionTokens } from '../theme/tokens'

type Status = 'idle' | 'submitted'

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Quiz(rawProps: unknown) {
  const props = QuizProps.parse(rawProps)
  const { question, choices, explanation, multiSelect } = props

  const baseId = useId()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [status, setStatus] = useState<Status>('idle')

  const correctSet = useMemo(
    () => new Set(choices.map((c, i) => (c.correct ? i : -1)).filter((i) => i >= 0)),
    [choices]
  )

  const submitted = status === 'submitted'
  const allCorrect = useMemo(() => {
    if (selected.size !== correctSet.size) return false
    for (const i of selected) if (!correctSet.has(i)) return false
    return true
  }, [selected, correctSet])

  const neutral = series.teal
  const good = series.lime
  const bad = series.coral

  function toggle(i: number) {
    if (submitted) return
    if (multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
    } else {
      setSelected(new Set([i]))
    }
  }

  function onSubmit() {
    if (selected.size === 0) return
    setStatus('submitted')
  }

  function onReset() {
    setStatus('idle')
    setSelected(new Set())
  }

  const feedbackSeries = submitted ? (allCorrect ? good : bad) : neutral
  const feedbackPatternId = `quiz-stripe-${baseId.replace(/[^a-z0-9]/gi, '')}`

  return (
    <section
      aria-label={question}
      className="not-prose my-6 rounded-md border-2 overflow-hidden bg-card"
      style={{ borderColor: neutral.stroke }}
    >
      <div className="px-4 py-3 border-b-2" style={{ borderColor: neutral.stroke }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: neutral.text }}>
          Quiz
        </p>
        <p className="mt-1 text-base font-medium text-foreground">{question}</p>
        {multiSelect && (
          <p className="mt-1 text-xs text-muted-foreground">Select all that apply.</p>
        )}
      </div>
      <ul className="divide-y divide-border/60">
        {choices.map((c, i) => {
          const isSelected = selected.has(i)
          const isCorrect = correctSet.has(i)
          let tone = neutral
          let label: string | null = null
          if (submitted) {
            if (isCorrect) {
              tone = good
              label = 'Correct'
            } else if (isSelected) {
              tone = bad
              label = 'Incorrect'
            }
          } else if (isSelected) {
            tone = neutral
          }
          const showStrong = submitted ? isCorrect || isSelected : isSelected
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={submitted}
                onClick={() => toggle(i)}
                className={cx(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition',
                  'disabled:cursor-default',
                  !submitted && 'hover:bg-muted/40 cursor-pointer'
                )}
                style={{
                  background: showStrong ? tone.fill : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border-2',
                    multiSelect ? 'rounded-sm' : 'rounded-full'
                  )}
                  style={{
                    borderColor: tone.stroke,
                    background: showStrong ? tone.fillStrong : 'transparent',
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path
                        d="M2 6l3 3 5-6"
                        fill="none"
                        stroke={tone.stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="flex-1 text-sm text-foreground">{c.text}</span>
                {label && (
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: tone.text }}
                  >
                    {label}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <div
        className="flex items-center justify-between px-4 py-3 border-t-2 bg-muted/20"
        style={{ borderColor: neutral.stroke }}
      >
        {!submitted ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={selected.size === 0}
            className="rounded-md border-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: neutral.stroke,
              color: neutral.text,
              background: neutral.fill,
            }}
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border-2 px-3 py-1.5 text-sm font-semibold"
            style={{
              borderColor: neutral.stroke,
              color: neutral.text,
              background: 'transparent',
            }}
          >
            Try again
          </button>
        )}
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: feedbackSeries.text }}
        >
          {!submitted &&
            (multiSelect ? `${selected.size} selected` : selected.size > 0 ? 'Ready' : '')}
          {submitted && (allCorrect ? 'All correct' : 'Not quite')}
        </span>
      </div>
      {submitted && explanation && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: motionTokens.durationBase, ease: motionTokens.ease }}
          className="border-t-2 overflow-hidden"
          style={{ borderColor: feedbackSeries.stroke }}
        >
          <svg
            aria-hidden="true"
            className="block w-full"
            height="6"
            preserveAspectRatio="none"
            viewBox="0 0 100 6"
          >
            <defs>
              <pattern
                id={feedbackPatternId}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={feedbackSeries.fillStrong} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={feedbackSeries.stroke} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100" height="6" fill={`url(#${feedbackPatternId})`} />
          </svg>
          <div
            className="px-4 py-3 text-sm text-foreground"
            style={{ background: feedbackSeries.fill }}
          >
            <p
              className="mb-1 text-xs font-bold uppercase tracking-wider"
              style={{ color: feedbackSeries.text }}
            >
              {allCorrect ? 'Why' : 'Explanation'}
            </p>
            {explanation}
          </div>
        </motion.div>
      )}
    </section>
  )
}
