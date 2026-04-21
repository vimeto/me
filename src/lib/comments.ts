// Thin client for the Cloudflare Worker comments API. The worker is proxied
// at the same origin in production (`/api/*`); in local dev set
// `VITE_API_BASE_URL=http://127.0.0.1:8787` when running `pnpm worker:dev`
// alongside `pnpm dev` so the browser hits the real worker.

export type PublicComment = {
  id: number
  author: string
  bodyHtml: string
  createdAt: string
}

export type CommentListResponse = {
  post: string
  count: number
  comments: PublicComment[]
}

export type CommentSubmission = {
  slug: string
  author: string
  email?: string
  body: string
  turnstileToken?: string
  honeypot?: string
}

export type CommentSubmitResponse =
  | { status: 'approved' | 'pending'; id: number | null }
  | { error: string; issues?: string[] }

function apiBase(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return env?.VITE_API_BASE_URL ?? ''
}

export async function fetchComments(slug: string): Promise<PublicComment[]> {
  const res = await fetch(`${apiBase()}/api/comments?post=${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`comments api ${res.status}`)
  const data = (await res.json()) as CommentListResponse
  return data.comments
}

export async function submitComment(input: CommentSubmission): Promise<CommentSubmitResponse> {
  const res = await fetch(`${apiBase()}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as CommentSubmitResponse
  return data
}
