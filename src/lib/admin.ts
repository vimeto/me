// Admin API client. Routes are proxied through the worker at `/api/admin/*`
// and gated by Cloudflare Access — the browser's signed-in Access cookie is
// forwarded automatically, so we don't need to set any headers here.
//
// Shape of records comes straight from the worker (`CommentRow` in the worker
// project). We keep a separate type alias to avoid pulling worker types into
// the SPA bundle.

export type AdminComment = {
  id: number
  post_slug: string
  author_name: string
  author_email: string | null
  body: string
  body_html: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  moderated_at: string | null
  moderation_reason: string | null
}

export type AdminStatus = AdminComment['status']

function apiBase(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return env?.VITE_API_BASE_URL ?? ''
}

export async function listAdminComments(status: AdminStatus): Promise<AdminComment[]> {
  const res = await fetch(`${apiBase()}/api/admin/comments?status=${encodeURIComponent(status)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (res.status === 401) throw new Error('unauthenticated')
  if (!res.ok) throw new Error(`admin api ${res.status}`)
  const body = (await res.json()) as { comments: AdminComment[] }
  return body.comments
}

async function postAdmin(path: string, body?: unknown) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`admin api ${res.status}`)
  return res.json()
}

export function approveComment(id: number) {
  return postAdmin(`/api/admin/comments/${id}/approve`)
}

export function rejectComment(id: number, reason?: string) {
  return postAdmin(`/api/admin/comments/${id}/reject`, reason ? { reason } : undefined)
}

export async function deleteComment(id: number) {
  const res = await fetch(`${apiBase()}/api/admin/comments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`admin api ${res.status}`)
  return res.json()
}
