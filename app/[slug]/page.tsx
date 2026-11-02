import { notFound } from 'next/navigation';
import { loadBlog } from '../../src/blog';
import { PageView } from '../../src/page-view';
import { atLeastOne, RedirectPage, redirectSlugs, redirectTarget } from '../../src/redirect';

export const dynamicParams = false;

/** 공개된 고정 페이지와, 공개된 이동 기록의 옛 주소. `404.md`는 not-found 화면이 쓴다. */
export function generateStaticParams() {
  const blog = loadBlog();
  return atLeastOne([
    ...blog.pages.map((page) => ({ slug: page.slug as string })),
    ...redirectSlugs(blog, 'page').map((slug) => ({ slug })),
  ]);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = loadBlog().pages.find((p) => p.slug === slug);
  return page ? { title: page.title, description: page.summary } : { title: '이동 중이에요' };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const blog = loadBlog();
  const page = blog.pages.find((p) => p.slug === slug);
  if (!page) {
    const to = redirectTarget(blog, 'page', slug);
    if (!to) notFound();
    return <RedirectPage to={to} />;
  }
  return <PageView blog={blog} page={page} />;
}
