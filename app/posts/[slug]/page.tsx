import { notFound } from 'next/navigation';
import { loadBlog } from '../../../src/blog';
import { PostView } from '../../../src/post-view';
import { atLeastOne, RedirectPage, redirectSlugs, redirectTarget } from '../../../src/redirect';

export const dynamicParams = false;

/** 공개된 글과, 공개된 이동 기록의 옛 주소 */
export function generateStaticParams() {
  const blog = loadBlog();
  return atLeastOne([
    ...blog.posts.map((post) => ({ slug: post.slug as string })),
    ...redirectSlugs(blog, 'post').map((slug) => ({ slug })),
  ]);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = loadBlog().posts.find((p) => p.slug === slug);
  return post ? { title: post.title, description: post.summary } : { title: '이동 중이에요' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blog = loadBlog();
  const post = blog.posts.find((p) => p.slug === slug);
  if (!post) {
    const to = redirectTarget(blog, 'post', slug);
    if (!to) notFound();
    return <RedirectPage to={to} />;
  }

  return <PostView blog={blog} post={post} />;
}
