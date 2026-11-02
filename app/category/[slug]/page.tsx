import { notFound } from 'next/navigation';
import { loadBlog } from '../../../src/blog';
import { ListView } from '../../../src/list-view';
import { atLeastOne, RedirectPage, redirectSlugs, redirectTarget } from '../../../src/redirect';

export const dynamicParams = false;

/** 모든 카테고리와, 공개된 이동 기록의 옛 주소 */
export function generateStaticParams() {
  const blog = loadBlog();
  return atLeastOne([
    ...blog.site.categories.items.map((category) => ({ slug: category.slug as string })),
    ...redirectSlugs(blog, 'category').map((slug) => ({ slug })),
  ]);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = loadBlog().site.categories.items.find((item) => item.slug === slug);
  return { title: category?.name ?? '이동 중이에요' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blog = loadBlog();
  const category = blog.site.categories.items.find((item) => item.slug === slug);
  if (!category) {
    const to = redirectTarget(blog, 'category', slug);
    if (!to) notFound();
    return <RedirectPage to={to} />;
  }
  return (
    <ListView
      blog={blog}
      current={{ type: 'category', slug }}
      title={category.name}
      posts={blog.posts.filter((post) => post.category === slug)}
    />
  );
}
