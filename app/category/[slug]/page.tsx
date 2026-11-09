import { notFound } from 'next/navigation';
import { loadTheme } from '../../../src/active-theme';
import { loadBlog } from '../../../src/blog';
import { atLeastOne, RedirectPage, redirectSlugs, redirectTarget } from '../../../src/redirect';
import { ThemeScreen } from '../../../src/screen';
import { shareMetadata, siteDescription } from '../../../src/share';
import { categoryProps } from '../../../src/theme-props';

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
  const blog = loadBlog();
  const category = blog.site.categories.items.find((item) => item.slug === slug);
  if (!category) return { title: '이동 중이에요' };
  return {
    title: category.name,
    ...shareMetadata(blog, {
      title: category.name,
      description: siteDescription(blog),
      route: { type: 'category', slug: category.slug },
    }),
  };
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
  const { theme, context } = loadTheme();
  return (
    <ThemeScreen
      theme={theme}
      screen={{ type: 'category', props: categoryProps(context, category) }}
    />
  );
}
