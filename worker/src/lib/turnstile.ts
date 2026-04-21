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
      if (!token) return false
      const form = new FormData()
      form.append('secret', secret)
      form.append('response', token)
      if (clientIp) form.append('remoteip', clientIp)
      try {
        const res = await fetch(VERIFY_URL, { method: 'POST', body: form })
        if (!res.ok) return false
        const data = (await res.json()) as { success?: boolean }
        return data.success === true
      } catch {
        // Fail closed on network errors — better to reject a legitimate
        // comment than to let every request through when the check is down.
        return false
      }
    },
  }
}
