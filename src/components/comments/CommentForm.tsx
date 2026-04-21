import { useId, useState } from 'react'
import { submitComment } from '@/lib/comments'

type Props = {
  slug: string
  onSubmitted?: (status: 'approved' | 'pending') => void
}

// Turnstile sitekey is public (safe to embed); the secret lives server-side.
// Only render the widget when the sitekey is set — otherwise the form falls
// through to plain submission, which the worker accepts when TURNSTILE_SECRET
// is unset (i.e. local dev).
function getTurnstileSitekey(): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return env?.VITE_TURNSTILE_SITEKEY
}

type FormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

export function CommentForm({ slug, onSubmitted }: Props) {
  const authorId = useId()
  const emailId = useId()
  const bodyId = useId()
  // Honeypot input — hidden via CSS, only bots fill it in.
  const honeypotId = useId()
  const turnstileSitekey = getTurnstileSitekey()
  const [state, setState] = useState<FormState>({ status: 'idle' })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const author = String(form.get('author') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const body = String(form.get('body') ?? '').trim()
    const honeypot = String(form.get('url') ?? '') // hidden field labelled 'url'
    const turnstileToken = String(form.get('cf-turnstile-response') ?? '')

    if (!author || !body) {
      setState({ status: 'error', message: 'Name and comment are required.' })
      return
    }
    if (body.length > 4000) {
      setState({ status: 'error', message: 'Comment is too long (4000 chars max).' })
      return
    }

    setState({ status: 'submitting' })
    try {
      const res = await submitComment({
        slug,
        author,
        email,
        body,
        honeypot,
        turnstileToken,
      })
      if ('error' in res) {
        setState({ status: 'error', message: res.error })
        return
      }
      const message =
        res.status === 'approved'
          ? 'Thanks! Your comment is live.'
          : 'Thanks! Your comment is in the moderation queue.'
      setState({ status: 'ok', message })
      e.currentTarget.reset()
      onSubmitted?.(res.status)
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  if (state.status === 'ok') {
    return (
      <div className="border border-border rounded p-4 text-sm bg-muted/30">
        {state.message}
        <button
          type="button"
          className="ml-3 underline text-muted-foreground hover:text-foreground"
          onClick={() => setState({ status: 'idle' })}
        >
          Leave another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={authorId} className="block text-xs font-semibold mb-1">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            id={authorId}
            name="author"
            type="text"
            required
            maxLength={80}
            className="w-full border border-border bg-background rounded px-3 py-2 text-sm"
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor={emailId} className="block text-xs font-semibold mb-1">
            Email <span className="text-muted-foreground font-normal">(optional, not public)</span>
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            maxLength={200}
            className="w-full border border-border bg-background rounded px-3 py-2 text-sm"
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <label htmlFor={bodyId} className="block text-xs font-semibold mb-1">
          Comment <span className="text-destructive">*</span>
        </label>
        <textarea
          id={bodyId}
          name="body"
          required
          rows={4}
          maxLength={4000}
          className="w-full border border-border bg-background rounded px-3 py-2 text-sm font-mono"
          placeholder="Plain text only. A human reviews everything before it goes live."
        />
      </div>

      {/* Honeypot: hidden from humans, filled by dumb bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
        <label htmlFor={honeypotId}>Do not fill this field</label>
        <input id={honeypotId} name="url" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {turnstileSitekey && (
        <div className="cf-turnstile" data-sitekey={turnstileSitekey} data-theme="auto" />
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state.status === 'submitting'}
          className="bg-foreground text-background px-4 py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {state.status === 'submitting' ? 'Submitting…' : 'Post comment'}
        </button>
        {state.status === 'error' && (
          <span className="text-xs text-destructive">{state.message}</span>
        )}
      </div>
    </form>
  )
}
