import {
  absoluteUrl,
  type Category,
  type Extra,
  type MediaPath,
  type Page,
  type Post,
  routePath,
  type NavLink as SchemaNavLink,
  withBasePath,
} from '@lbs/schema';
import type {
  CategoryData,
  CategoryRef,
  CommonProps,
  ImageData,
  Json,
  LinkData,
  ListProps,
  NavItem,
  NotFoundProps,
  PageDetail,
  PageProps,
  PostProps,
  PostSummary,
  Route,
  SettingDefinition,
  SettingValue,
  SiteData,
} from '@lbs/theme-kit';
import { type Blog, categoryOf, coverAlt, featuredPost, publishedAt, relatedPosts } from './blog';
import { renderBody } from './body';
import { feedAlternate } from './feed';

/**
 * 콘텐츠(`Blog`)를 테마 계약의 화면별 값으로 바꾼다. 빌드(`app/`)와 CMS 미리보기(`src/preview.tsx`)가 같은 함수를 쓴다.
 * 값은 모두 JSON으로 옮길 수 있다. 렌더링 중에 파일이나 환경 변수를 읽지 않는다.
 */
export interface ThemeContext {
  blog: Blog;
  /** 테마 설정 값. 정의대로 검사하고 기본값을 채웠고, 이미지 설정은 주소로 바꿨다(`themeSettings`) */
  settings: Readonly<Record<string, SettingValue>>;
  /** CMS 미리보기 안에서 그린다 */
  preview: boolean;
}

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

/** 테마 설정 값 중 이미지(`/media/...`)를 basePath까지 붙인 주소로 바꾼다. */
export function themeSettings(
  blog: Blog,
  definitions: readonly SettingDefinition[],
  values: Readonly<Record<string, SettingValue>>,
): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = { ...values };
  for (const definition of definitions) {
    const value = out[definition.key];
    if (definition.type === 'image' && typeof value === 'string') {
      out[definition.key] = mediaSrc(blog, value);
    }
  }
  return out;
}

const toJson = (extra: Extra) => JSON.parse(JSON.stringify(extra)) as Record<string, Json>;

function categoryRef(category: Category): CategoryRef {
  return {
    slug: category.slug,
    name: category.name,
    href: routePath({ type: 'category', slug: category.slug }),
  };
}

function image(blog: Blog, path: MediaPath): ImageData {
  return { src: mediaSrc(blog, path), alt: coverAlt(blog, path) };
}

export function postSummary(blog: Blog, post: Post): PostSummary {
  const at = publishedAt(post);
  return {
    slug: post.slug,
    href: routePath({ type: 'post', slug: post.slug }),
    title: post.title,
    summary: post.summary,
    author: post.author,
    category: categoryRef(categoryOf(blog, post)),
    tags: post.tags ?? [],
    publishedAt: at,
    date: formatDate(blog, at),
    dateLong: formatDate(blog, at, true),
    readingTime: readingTime(blog, post.body),
    cover: post.cover ? image(blog, post.cover) : undefined,
    featured: post.extra.featured === true,
    extra: toJson(post.extra),
  };
}

function siteData(blog: Blog): SiteData {
  const { name, tagline, description, language, timeZone, extra } = blog.site.info;
  const year = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(blog.now);
  return {
    name,
    tagline,
    description,
    language,
    timeZone,
    copyright: `© ${year} ${name}`,
    feedUrl: feedAlternate(blog)?.url,
    extra: toJson(extra),
  };
}

function isCurrent(link: SchemaNavLink, route: Route): boolean {
  if (link.type === 'external' || link.type !== route.type) return false;
  return link.type === 'home' || ('slug' in route && route.slug === link.slug);
}

function linkOf(link: SchemaNavLink, route: Route): LinkData {
  if (link.type === 'external')
    return { label: link.label, href: link.url, newTab: link.newTab || undefined };
  return { label: link.label, href: routePath(link), current: isCurrent(link, route) || undefined };
}

/** 메뉴. 공개되지 않은 대상을 가리키는 항목을 이미 뺀 `visibleNavigation`만 쓴다. */
function navItems(blog: Blog, route: Route): NavItem[] {
  return blog.site.visibleNavigation.items.map((item) =>
    item.type === 'group'
      ? {
          kind: 'group',
          label: item.label,
          children: item.children.map((child) => linkOf(child, route)),
        }
      : { kind: 'link', ...linkOf(item, route) },
  );
}

function categoryData(blog: Blog, category: Category, route: Route): CategoryData {
  return {
    ...categoryRef(category),
    postCount: blog.posts.filter((post) => post.category === category.slug).length,
    current: (route.type === 'category' && route.slug === category.slug) || undefined,
  };
}

export function commonProps(context: ThemeContext, route: Route): CommonProps {
  const { blog } = context;
  return {
    site: siteData(blog),
    nav: navItems(blog, route),
    categories: blog.site.categories.items
      .map((category) => categoryData(blog, category, route))
      .filter((category) => category.postCount > 0),
    settings: context.settings,
    route,
    preview: context.preview,
  };
}

/** 템플릿은 아직 쪽을 나누지 않는다 */
const ONE_PAGE = { page: 1, totalPages: 1 };

export function homeProps(context: ThemeContext): ListProps {
  const { blog } = context;
  const { info } = blog.site;
  const featured = featuredPost(blog);
  return {
    ...commonProps(context, { type: 'home' }),
    route: { type: 'home' },
    title: info.tagline ?? info.name,
    lead: info.description,
    featured: featured ? postSummary(blog, featured) : undefined,
    posts: blog.posts.filter((post) => post !== featured).map((post) => postSummary(blog, post)),
    pagination: ONE_PAGE,
  };
}

export function categoryProps(context: ThemeContext, category: Category): ListProps {
  const { blog } = context;
  const route = { type: 'category', slug: category.slug } as const;
  return {
    ...commonProps(context, route),
    route,
    title: category.name,
    category: categoryData(blog, category, route),
    posts: blog.posts
      .filter((post) => post.category === category.slug)
      .map((post) => postSummary(blog, post)),
    pagination: ONE_PAGE,
  };
}

export function postProps(context: ThemeContext, post: Post): PostProps {
  const { blog } = context;
  const route = { type: 'post', slug: post.slug } as const;
  const index = blog.posts.findIndex((p) => p.slug === post.slug);
  // 목록은 최신순이라 앞에 발행한 글이 뒤에 있다
  const previous = index >= 0 ? blog.posts[index + 1] : undefined;
  const next = index > 0 ? blog.posts[index - 1] : undefined;
  return {
    ...commonProps(context, route),
    route,
    post: {
      ...postSummary(blog, post),
      body: renderBody(post.body, blog.basePath, { imageSrc: blog.imageSrc }),
    },
    related: relatedPosts(blog, post).map((p) => postSummary(blog, p)),
    sameCategory: blog.posts
      .filter((p) => p.category === post.category)
      .map((p) => postSummary(blog, p)),
    previous: previous ? postSummary(blog, previous) : undefined,
    next: next ? postSummary(blog, next) : undefined,
    share: {
      url: blog.origin ? absoluteUrl(blog.origin, blog.basePath, routePath(route)) : undefined,
      title: post.title,
      text: post.summary,
    },
  };
}

function pageDetail(blog: Blog, page: Page): PageDetail {
  return {
    slug: page.slug,
    href: routePath({ type: 'page', slug: page.slug }),
    title: page.title,
    summary: page.summary,
    body: renderBody(page.body, blog.basePath, { imageSrc: blog.imageSrc }),
    extra: toJson(page.extra),
  };
}

export function pageProps(context: ThemeContext, page: Page): PageProps {
  const route = { type: 'page', slug: page.slug } as const;
  return { ...commonProps(context, route), route, page: pageDetail(context.blog, page) };
}

export function notFoundProps(context: ThemeContext): NotFoundProps {
  const { blog } = context;
  const route = { type: 'not-found' } as const;
  return {
    ...commonProps(context, route),
    route,
    page: blog.notFound ? pageDetail(blog, blog.notFound) : undefined,
  };
}
