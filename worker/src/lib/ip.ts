// SHA-256 of `${salt}:${ip}`, hex-encoded. Used as `client_ip_hash` in the
// comments and submission_log tables. The salt comes from `IP_HASH_SALT` in
// `.dev.vars` / worker secrets; unset falls back to a build-time default,
// which is only safe for tests — production must set an explicit salt.
export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const view = new Uint8Array(digest)
  let out = ''
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0')
  }
  return out
}
