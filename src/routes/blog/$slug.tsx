import { useParams } from 'react-router'
import { getPost } from '@/lib/content/posts'
import { PostLayout } from '@/components/mdx/layout/PostLayout'

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined

  if (!post) {
    return (
      <section className="min-h-screen px-6 py-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Not found</h1>
          <p className="text-sm text-muted-foreground">
            No post exists at this URL.
          </p>
        </div>
      </section>
    )
  }

  const Body = post.Body

  return (
    <PostLayout meta={post}>
      <Body />
    </PostLayout>
  )
}
