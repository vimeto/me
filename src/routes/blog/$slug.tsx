import { useParams } from 'react-router'
import { getPost } from '@/lib/content/posts'
import { PostLayout } from '@/components/mdx/layout/PostLayout'
import { Comments } from '@/components/comments/Comments'

export default function BlogPost() {
  const { slug, lang } = useParams<{ slug: string; lang?: string }>()
  const post = slug ? getPost(slug, lang) : undefined

  if (!post) {
    return (
      <section className="min-h-screen px-6 py-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Not found</h1>
          <p className="text-sm text-muted-foreground">No post exists at this URL.</p>
        </div>
      </section>
    )
  }

  const Body = post.Body

  return (
    <PostLayout meta={post}>
      <Body />
      {post.slug && <Comments slug={post.slug} />}
    </PostLayout>
  )
}
