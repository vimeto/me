// Minimal HTML sanitisation. v1 comments only allow plain text; we escape
// the five XML entities and wrap blank-line-separated paragraphs in <p>.
// Keeps the attack surface tiny — no markdown, no attributes, no URLs auto-
// linked. Future iterations can swap in a full CommonMark subset if needed.

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c])
}

export function toSafeHtml(body: string): string {
  // Normalise line endings, split on blank lines, escape each paragraph,
  // turn single newlines into <br>.
  const paragraphs = body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  if (paragraphs.length === 0) return ''
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n')
}
