import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  type BasePath,
  type Category,
  type MediaPath,
  normalizeBasePath,
  normalizeSiteOrigin,
  type Page,
  type Post,
  pagesOrigin,
  parseSite,
  publishedPosts,
  type RedirectStub,
  redirectStubs,
  type Site,
  type SiteOrigin,
  type SourceFile,
  unwrap,
} from '@lbs/schema';

/**
 * 블로그 저장소의 내용을 한 번 읽어 빌드 전체가 같은 값을 쓰게 한다.
 * - 저장소 루트는 빌드를 실행한 폴더다(시험에서는 `LBS_ROOT`로 바꾼다).
 * - `now`는 빌드 시각이다. `next.config.ts`가 한 번 정해서 `LBS_BUILD_TIME`으로 넘기고,
 *   `parseSite`(메뉴·이동 기록)와 `publishedPosts`(글 목록)가 같은 값을 쓴다.
 * - 콘텐츠에 문제가 있으면 `ContentError`를 던져 빌드를 멈춘다.
 */
export interface Blog {
  site: Site;
  basePath: BasePath;
  /**
   * 사이트 주소의 맨 앞(`https://owner.github.io`). 공유 미리보기의 절대 주소에 쓴다. 알 수 없으면 없다.
   * 빌드는 `LBS_SITE_ORIGIN`, 없으면 Actions의 `GITHUB_REPOSITORY`에서 만든다.
   */
  origin?: SiteOrigin;
  now: Date;
  /** 지금 공개된 글, 최신순. 화면의 어떤 목록도 `site.posts` 대신 이 값을 쓴다. */
  posts: Post[];
  /** 지금 공개된 고정 페이지(404 시스템 페이지 제외) */
  pages: Page[];
  /** `404.md`가 있으면 그 내용. 없으면 기본 문구를 쓴다. */
  notFound?: Page;
  stubs: RedirectStub[];
  /**
   * 본문과 대표 이미지의 사이트 안 이미지 주소(`/media/...`)를 바꾸는 함수. 빌드에서는 쓰지 않고(basePath만 붙인다),
   * CMS 미리보기가 저장소의 이미지를 미리 보기 주소로 바꿀 때만 넘긴다.
   */
  imageSrc?: (path: string) => string;
}

export const NOT_FOUND_SLUG = '404';

/** 저장소 루트에서 읽을 파일. `parseSite`가 표에 없는 파일은 무시하므로 `content/` 아래는 모두 넘긴다. */
export function readSourceFiles(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  const add = (path: string) => {
    try {
      files.push({ path, text: readFileSync(join(root, path), 'utf8') });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
  add('lbs.json');
  add('theme/tokens.json');
  try {
    for (const entry of readdirSync(join(root, 'content'), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile())
        add(relative(root, join(entry.parentPath, entry.name)).split(/[\\/]/).join('/'));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return files;
}

/** 저장소 루트의 `public/media/` 아래 모든 파일의 저장소 경로(`public/media/2026/10/a.png`) */
export function readMediaRepoPaths(root: string): Set<string> {
  const paths = new Set<string>();
  try {
    for (const entry of readdirSync(join(root, 'public/media'), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile())
        paths.add(relative(root, join(entry.parentPath, entry.name)).split(/[\\/]/).join('/'));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return paths;
}

export interface BuildBlogOptions {
  /** 저장소의 파일 경로. 주면 대표 이미지와 기본 공유 이미지 파일이 있는지 검사한다. */
  repoPaths?: ReadonlySet<string>;
  /** 사이트 주소의 맨 앞. `https://owner.github.io` */
  origin?: string;
}

export function buildBlog(
  files: Iterable<SourceFile>,
  basePathInput: string | undefined,
  now: Date,
  options: BuildBlogOptions = {},
): Blog {
  const site = unwrap(parseSite(files, now, { repoPaths: options.repoPaths }));
  return { ...blogFromSite(site, basePathInput, now), origin: normalizeSiteOrigin(options.origin) };
}

/** 이미 해석한 사이트로 `Blog`를 만든다. 빌드와 CMS 미리보기가 같은 규칙(공개 여부, 이동 기록)을 쓴다. */
export function blogFromSite(site: Site, basePathInput: string | undefined, now: Date): Blog {
  const basePath = normalizeBasePath(basePathInput);
  const posts = publishedPosts(site.posts, now);
  const published = site.pages.filter((page) => page.status === 'published');
  return {
    site,
    basePath,
    now,
    posts,
    pages: published.filter((page) => page.slug !== NOT_FOUND_SLUG),
    notFound: published.find((page) => page.slug === NOT_FOUND_SLUG),
    stubs: redirectStubs(site.visibleRedirects, basePath),
  };
}

let cached: Blog | undefined;

export function loadBlog(): Blog {
  if (cached) return cached;
  const built = process.env.LBS_BUILD_TIME;
  const now = built ? new Date(built) : new Date();
  const root = process.env.LBS_ROOT || process.cwd();
  cached = buildBlog(readSourceFiles(root), process.env.NEXT_PUBLIC_BASE_PATH, now, {
    repoPaths: readMediaRepoPaths(root),
    origin: process.env.LBS_SITE_ORIGIN?.trim() || pagesOrigin(process.env.GITHUB_REPOSITORY),
  });
  return cached;
}

export function categoryOf(blog: Blog, post: Post): Category {
  const category = blog.site.categories.items.find((item) => item.slug === post.category);
  // parseSite가 모든 글의 카테고리가 목록에 있는지 검사한다.
  if (!category) throw new Error(`카테고리 '${post.category}'를 찾을 수 없어요.`);
  return category;
}

/** 대표 이미지의 대체 글자. `content/media.json`에 없으면 빈 글자다. */
export function coverAlt(blog: Blog, path: MediaPath): string {
  return blog.site.media.items[path]?.alt ?? '';
}

export function publishedAt(post: Post): string {
  return post.publishAt ?? '';
}

/** 홈에서 크게 보여 줄 글. front matter에 `featured: true`를 쓴 가장 최근 글, 없으면 가장 최근 글. */
export function featuredPost(blog: Blog): Post | undefined {
  return blog.posts.find((post) => post.extra.featured === true) ?? blog.posts[0];
}

/** 같은 카테고리의 글을 먼저, 모자라면 태그가 겹치는 글로 채운다. 공개된 글만 쓴다. */
export function relatedPosts(blog: Blog, post: Post, limit = 4): Post[] {
  const others = blog.posts.filter((p) => p.slug !== post.slug);
  const tags = new Set(post.tags ?? []);
  const score = (p: Post) =>
    (p.category === post.category ? 10 : 0) + (p.tags ?? []).filter((t) => tags.has(t)).length;
  return others
    .map((p) => ({ p, s: score(p) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p }) => p);
}
