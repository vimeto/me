// LLM-based comment moderation via Anthropic's Claude Haiku.
//
// The pipeline asks the model to classify a comment as one of three buckets:
//   approve — benign / on-topic
//   reject  — spam, abuse, obvious garbage
//   review  — ambiguous, push to human queue
//
// Design choices:
//   - Tiny prompt, temperature 0 for reproducibility.
//   - Classification is returned as a single JSON object, not free text.
//   - Network or parse failures fall back to `review` so that bad upstream
//     state never auto-approves a comment.

export type ModerationVerdict = 'approve' | 'reject' | 'review'

export interface ModerationInput {
  slug: string
  author: string
  body: string
}

export interface ModerationClient {
  check(input: ModerationInput): Promise<{ verdict: ModerationVerdict; reason: string }>
}

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are a comment moderator for a personal technical blog about AI and math.
Classify each comment as one of: approve, reject, review.

- approve: on-topic or polite off-topic, no spam signals, no abuse.
- reject: obvious spam (links to unrelated sites, crypto shilling, SEO fodder), abuse, hate.
- review: borderline, ambiguous, or unusually long — push to human moderator.

Always respond as JSON: {"verdict":"approve|reject|review","reason":"<short explanation>"}`

export function makeModeration(apiKey: string | undefined): ModerationClient | null {
  if (!apiKey) return null
  return {
    async check(input) {
      const user = `Post slug: ${input.slug}\nAuthor: ${input.author}\nBody:\n${input.body}`
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 256,
            temperature: 0,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: user }],
          }),
        })
        if (!res.ok) {
          console.warn('moderation api non-200:', res.status)
          return { verdict: 'review', reason: `api ${res.status}` }
        }
        const data = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>
        }
        const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
        const parsed = parseVerdict(text)
        return parsed ?? { verdict: 'review', reason: 'unparseable moderator response' }
      } catch (err) {
        console.warn('moderation error:', err instanceof Error ? err.message : err)
        return { verdict: 'review', reason: 'moderator error' }
      }
    },
  }
}

function parseVerdict(text: string): { verdict: ModerationVerdict; reason: string } | null {
  // Model sometimes wraps JSON in code fences. Pull out the first {...} block.
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0]) as { verdict?: unknown; reason?: unknown }
    if (obj.verdict !== 'approve' && obj.verdict !== 'reject' && obj.verdict !== 'review') {
      return null
    }
    const reason = typeof obj.reason === 'string' ? obj.reason.slice(0, 500) : ''
    return { verdict: obj.verdict, reason }
  } catch {
    return null
  }
}
