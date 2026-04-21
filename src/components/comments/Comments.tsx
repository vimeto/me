import { useEffect, useState } from 'react'
import { CommentList } from './CommentList'
import { CommentForm } from './CommentForm'

type Props = {
  slug: string
}

// Turnstile script — load once, client-only, lazily. Cloudflare injects its
// widget into any element with `class="cf-turnstile"` it finds at load time.
function useTurnstileScript(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (document.querySelector('script[data-cf-turnstile]')) return
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true
    s.defer = true
    s.setAttribute('data-cf-turnstile', '1')
    document.head.appendChild(s)
  }, [enabled])
}

export function Comments({ slug }: Props) {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const turnstileEnabled = Boolean(env?.VITE_TURNSTILE_SITEKEY)
  useTurnstileScript(turnstileEnabled)

  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <section
      aria-labelledby="comments-heading"
      className="mt-16 pt-8 border-t border-border not-prose"
    >
      <h2 id="comments-heading" className="text-lg font-semibold mb-6">
        Comments
      </h2>
      <div className="mb-10">
        <CommentList slug={slug} refreshKey={refreshKey} />
      </div>
      <div className="border-t border-border pt-8">
        <h3 className="text-sm font-semibold mb-4">Leave a comment</h3>
        <CommentForm
          slug={slug}
          onSubmitted={(status) => {
            // Only re-fetch when the moderator auto-approved — otherwise the
            // comment is pending and won't show up yet.
            if (status === 'approved') setRefreshKey((k) => k + 1)
          }}
        />
      </div>
    </section>
  )
}
