import { notFound } from 'next/navigation';
import { loadTheme } from '../../../src/active-theme';
import { loadBlog, publishedAt } from '../../../src/blog';
import { atLeastOne, RedirectPage, redirectSlugs, redirectTarget } from '../../../src/redirect';
import { ThemeScreen } from '../../../src/screen';
import { postDescription, shareMetadata } from '../../../src/share';
import { postProps } from '../../../src/theme-props';

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
  const blog = loadBlog();
  const post = blog.posts.find((p) => p.slug === slug);
  if (!post) return { title: '이동 중이에요' };
  return {
    title: post.title,
    ...shareMetadata(blog, {
      title: post.title,
      description: postDescription(blog, post),
      route: { type: 'post', slug: post.slug },
      image: post.cover,
      article: { publishedTime: publishedAt(post) },
    }),
  };
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
  const { theme, context } = loadTheme();
  return <ThemeScreen theme={theme} screen={{ type: 'post', props: postProps(context, post) }} />;
}
