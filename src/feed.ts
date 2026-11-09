import { absoluteUrl, FEED_PATH, type Route, routePath, SITEMAP_PATH } from '@lbs/schema';
import { type Blog, categoryOf, publishedAt } from './blog';
import { postDescription, siteDescription } from './share';

/** 피드에 넣는 글의 수. 최신순으로 이만큼만 넣는다. */
export const FEED_LIMIT = 50;

export const FEED_TYPE = 'application/rss+xml';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const isXmlChar = (code: number) =>
  code === 0x9 ||
  code === 0xa ||
  code === 0xd ||
  (code >= 0x20 && code <= 0xd7ff) ||
  (code >= 0xe000 && code <= 0xfffd) ||
  code >= 0x10000;

/** XML 글자와 속성값에 넣을 수 있게 바꾼다. XML 1.0이 허용하지 않는 글자(제어 문자 등)는 뺀다. */
export function escapeXml(text: string): string {
  const valid = [...text].filter((char) => isXmlChar(char.codePointAt(0) ?? 0)).join('');
  return valid.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? '');
}

const tag = (name: string, value: string, attrs = '') =>
  `<${name}${attrs}>${escapeXml(value)}</${name}>`;

/** RFC 822 날짜를 사이트 시간대로 쓴다(`Fri, 30 Oct 2026 10:00:00 +0900`). 가리키는 시각은 같고 숫자만 사이트 시간대로 보인다. */
export function rfc822Date(iso: string, timeZone: string): string {
  const part = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(iso))
      .map(({ type, value }) => [type, value]),
  );
  const offset = /GMT([+-])(\d\d):(\d\d)/.exec(part.timeZoneName ?? '');
  const zone = offset ? `${offset[1]}${offset[2]}${offset[3]}` : '+0000';
  return `${part.weekday}, ${part.day} ${part.month} ${part.year} ${part.hour}:${part.minute}:${part.second} ${zone}`;
}

/**
 * 사이트맵이 가리키는 주소: 홈, 공개된 글(최신순), 공개된 글이 있는 카테고리, 공개된 고정 페이지.
 * 이동 페이지(옛 주소)와 404 화면은 넣지 않는다. 글이 없는 카테고리는 빈 목록이라 검색에 알리지 않는다.
 */
export function publicRoutes(blog: Blog): Route[] {
  const used = new Set(blog.posts.map((post) => post.category));
  return [
    { type: 'home' },
    ...blog.posts.map((post): Route => ({ type: 'post', slug: post.slug })),
    ...blog.site.categories.items
      .filter((category) => used.has(category.slug))
      .map((category): Route => ({ type: 'category', slug: category.slug })),
    ...blog.pages.map((page): Route => ({ type: 'page', slug: page.slug })),
  ];
}

/** `sitemap.xml`. 사이트 주소를 모르면 절대 주소를 만들 수 없어 만들지 않는다. */
export function sitemapXml(blog: Blog): string | undefined {
  const { origin, basePath } = blog;
  if (!origin) return undefined;
  const urls = publicRoutes(blog).map(
    (route) => `  <url>${tag('loc', absoluteUrl(origin, basePath, routePath(route)))}</url>`,
  );
  return `${XML_HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** `feed.xml`(RSS 2.0). 공개된 글 최신 `FEED_LIMIT`개. 사이트 주소를 모르면 만들지 않는다. */
export function feedXml(blog: Blog): string | undefined {
  const { origin, basePath, site } = blog;
  if (!origin) return undefined;
  const { info } = site;
  const items = blog.posts.slice(0, FEED_LIMIT).map((post) => {
    const link = absoluteUrl(origin, basePath, routePath({ type: 'post', slug: post.slug }));
    const description = postDescription(blog, post);
    const cover = post.cover ? absoluteUrl(origin, basePath, post.cover) : undefined;
    const lines = [
      tag('title', post.title),
      tag('link', link),
      tag('guid', link, ' isPermaLink="true"'),
      tag('pubDate', rfc822Date(publishedAt(post), info.timeZone)),
      tag('category', categoryOf(blog, post).name),
      ...(description ? [tag('description', description)] : []),
      ...(cover ? [`<media:content url="${escapeXml(cover)}" medium="image"/>`] : []),
    ];
    return `    <item>\n${lines.map((line) => `      ${line}`).join('\n')}\n    </item>`;
  });
  const channel = [
    tag('title', info.name),
    tag('link', absoluteUrl(origin, basePath, routePath({ type: 'home' }))),
    tag('description', siteDescription(blog) ?? info.name),
    tag('language', info.language),
    `<atom:link href="${escapeXml(absoluteUrl(origin, basePath, FEED_PATH))}" rel="self" type="${FEED_TYPE}"/>`,
  ];
  return [
    `${XML_HEADER}<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">`,
    '  <channel>',
    ...channel.map((line) => `    ${line}`),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/**
 * 사이트 주소를 몰라 파일을 만들 수 없을 때 라우트가 돌려주는 상태. Next의 정적 내보내기는 404를 뺀 4xx 응답을
 * 결과물에 쓰지 않으므로, 0바이트 `feed.xml`이 200으로 나가는 대신 파일이 아예 없다.
 */
export const NOT_GENERATED_STATUS = 410;

/** 피드·사이트맵 라우트의 응답. 내용이 없으면 파일을 만들지 않고 빌드 로그에 이유를 남긴다. */
export function generatedFile(
  name: string,
  body: string | undefined,
  contentType: string,
): Response {
  if (body) return new Response(body, { headers: { 'Content-Type': contentType } });
  console.warn(
    `${name}: 사이트 주소를 몰라 만들지 않아요. 로컬에서 보려면 LBS_SITE_ORIGIN=https://owner.github.io 를 주고 빌드해요.`,
  );
  return new Response(null, { status: NOT_GENERATED_STATUS });
}

/** `robots.txt`. 모두 허용하고, 사이트 주소를 알면 사이트맵 위치를 알린다. */
export function robotsTxt(blog: Blog): string {
  const lines = ['User-agent: *', 'Allow: /'];
  if (blog.origin)
    lines.push('', `Sitemap: ${absoluteUrl(blog.origin, blog.basePath, SITEMAP_PATH)}`);
  return `${lines.join('\n')}\n`;
}

/** `<head>`의 피드 링크. 피드를 만들 수 없으면(사이트 주소를 모르면) 없다. */
export function feedAlternate(blog: Blog): { url: string; title: string } | undefined {
  if (!blog.origin) return undefined;
  return { url: absoluteUrl(blog.origin, blog.basePath, FEED_PATH), title: blog.site.info.name };
}
