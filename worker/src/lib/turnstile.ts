// Cloudflare Turnstile server-side verification.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export interface TurnstileClient {
  verify(token: string, clientIp?: string): Promise<boolean>
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function makeTurnstile(secret: string | undefined): TurnstileClient | null {
  if (!secret) return null
  return {
    async verify(token, clientIp) {
      if (!token) {
        console.warn('turnstile: no token in submission')
        return false
      }
      const form = new FormData()
      form.append('secret', secret)
      form.append('response', token)
      if (clientIp) form.append('remoteip', clientIp)
      try {
        const res = await fetch(VERIFY_URL, { method: 'POST', body: form })
        if (!res.ok) {
          console.warn('turnstile: siteverify non-200', res.status)
          return false
        }
        const data = (await res.json()) as {
          success?: boolean
          'error-codes'?: string[]
          hostname?: string
          action?: string
        }
        if (data.success !== true) {
          console.warn('turnstile: verify failed', JSON.stringify(data))
        }
        return data.success === true
      } catch (err) {
        // Fail closed on network errors — better to reject a legitimate
        // comment than to let every request through when the check is down.
        console.warn('turnstile: network error', err instanceof Error ? err.message : err)
        return false
      }
    },
  }
}
