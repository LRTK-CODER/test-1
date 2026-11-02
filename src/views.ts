import {
  type MediaPath,
  type NavItem,
  type Post,
  routePath,
  type NavLink as SchemaNavLink,
  withBasePath,
} from '@lbs/schema';
import type { NavLink, PostSummary } from '../theme';
import { type Blog, categoryOf, publishedAt } from './blog';

/** 날짜를 사이트 시간대와 언어로 쓴다. 올해가 아닌 글에는 연도를 붙인다. */
export function formatDate(blog: Blog, iso: string, forceYear = false): string {
  const { language, timeZone } = blog.site.info;
  const date = new Date(iso);
  const year = (d: Date) =>
    Number(new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(d));
  const withYear = forceYear || year(date) !== year(blog.now);
  return new Intl.DateTimeFormat(language, {
    timeZone,
    year: withYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** 본문 길이로 읽는 시간을 어림한다. 한국어는 분당 500자, 그 밖의 언어는 분당 200단어. */
export function readingTime(blog: Blog, body: string): string {
  const korean = blog.site.info.language.toLowerCase().startsWith('ko');
  const minutes = korean
    ? Math.ceil(body.replace(/\s+/g, '').length / 500)
    : Math.ceil(body.split(/\s+/).filter(Boolean).length / 200);
  const n = Math.max(1, minutes);
  return korean ? `${n}분` : `${n} min`;
}

/** 미디어 경로(`/media/...`)에 basePath를 붙인 이미지 주소. 이미지는 Next가 basePath를 붙여 주지 않는다. */
export function mediaSrc(blog: Blog, path: MediaPath | string): string {
  if (blog.imageSrc) return blog.imageSrc(path);
  return withBasePath(path, blog.basePath);
}

export function coverAlt(blog: Blog, path: MediaPath): string {
  return blog.site.media.items[path]?.alt ?? '';
}

/** 글 주소. 테마의 링크는 Next 링크라 basePath 없는 경로를 넘긴다. */
export function postHref(post: Pick<Post, 'slug'>): string {
  return routePath({ type: 'post', slug: post.slug });
}

export function postSummary(blog: Blog, post: Post, withExcerpt = false): PostSummary {
  return {
    href: postHref(post),
    title: post.title,
    category: categoryOf(blog, post).name,
    date: formatDate(blog, publishedAt(post)),
    readingTime: readingTime(blog, post.body),
    excerpt: withExcerpt ? post.summary : undefined,
    image: post.cover ? mediaSrc(blog, post.cover) : undefined,
  };
}

export type CurrentRoute =
  | { type: 'home' }
  | { type: 'post' | 'category' | 'page'; slug: string }
  | undefined;

function linkOf(link: SchemaNavLink, current: CurrentRoute): NavLink {
  if (link.type === 'external')
    return { label: link.label, href: link.url, newTab: link.newTab || undefined };
  const href = routePath(link);
  const isCurrent =
    current !== undefined &&
    current.type === link.type &&
    (link.type === 'home' || ('slug' in current && current.slug === link.slug));
  return { label: link.label, href, current: isCurrent || undefined };
}

/** 메뉴. 공개되지 않은 대상을 가리키는 항목을 이미 뺀 `visibleNavigation`만 쓴다. */
export function navLinks(blog: Blog, current: CurrentRoute): NavLink[] {
  return blog.site.visibleNavigation.items.map((item: NavItem) =>
    item.type === 'group'
      ? {
          label: item.label,
          children: item.children.map((child) => {
            const { label, href, newTab } = linkOf(child, current);
            return { label, href, newTab };
          }),
        }
      : linkOf(item, current),
  );
}

/** 카테고리 탭: 전체와, 공개된 글이 있는 카테고리 */
export function categoryTabs(blog: Blog, current: CurrentRoute): NavLink[] {
  const used = new Set(blog.posts.map((post) => post.category));
  return [
    { label: '전체', href: '/', current: current?.type === 'home' || undefined },
    ...blog.site.categories.items
      .filter((category) => used.has(category.slug))
      .map((category) => ({
        label: category.name,
        href: routePath({ type: 'category', slug: category.slug }),
        current: (current?.type === 'category' && current.slug === category.slug) || undefined,
      })),
  ];
}
