import { Link } from 'react-router'
import { listPosts } from '@/lib/content/posts'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogIndex() {
  const posts = listPosts()

  return (
    <section className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">WRITING</h1>
        {posts.length === 0 && (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        )}
        <div className="space-y-6">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-border pb-6">
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-bold text-lg flex-1">
                  <Link to={post.permalink} className="hover:underline underline-offset-4">
                    {post.title}
                  </Link>
                </h2>
                <time
                  dateTime={post.publishedAt}
                  className="text-sm text-muted-foreground ml-4"
                >
                  {formatDate(post.publishedAt)}
                </time>
              </div>
              {post.category && (
                <p className="text-sm text-muted-foreground mb-2">{post.category}</p>
              )}
              <p className="text-sm">{post.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
