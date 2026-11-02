import { blogFiles } from './files';
import type { ContentIssue, Result } from './issues';
import { postVisibility } from './publishing';
import type {
  Categories,
  Manifest,
  MediaLibrary,
  Navigation,
  NavLink,
  Page,
  Post,
  Redirect,
  Redirects,
  SiteInfo,
  ThemeTokens,
} from './schemas';
import { RESERVED_PAGE_SLUGS } from './schemas';

export interface SourceFile {
  /** 저장소 루트 기준 경로. 예: `content/posts/hello.md` */
  path: string;
  text: string;
}

export interface Site {
  manifest: Manifest;
  info: SiteInfo;
  categories: Categories;
  navigation: Navigation;
  redirects: Redirects;
  media: MediaLibrary;
  theme: ThemeTokens;
  posts: Post[];
  pages: Page[];
  /** 오류는 아니지만 알려 줄 것. 지금 공개되지 않은 글·페이지를 가리키는 메뉴와 이동 기록이다(#45). CMS는 보여 주기만 하고 저장을 막지 않는다. */
  warnings: ContentIssue[];
  /** `now` 시점에 보일 메뉴. 공개되지 않은 대상을 가리키는 항목과 비게 된 그룹을 뺐다. 블로그는 `navigation` 대신 이 값을 쓴다. */
  visibleNavigation: Navigation;
  /** `now` 시점에 이동 페이지를 만들 기록. 공개되지 않은 대상으로 가는 기록을 뺐다. 블로그는 `redirects.items` 대신 이 값을 쓴다. */
  visibleRedirects: Redirect[];
}

const JSON_KEYS = [
  'manifest',
  'info',
  'categories',
  'navigation',
  'redirects',
  'media',
  'theme',
] as const;

/**
 * 블로그 저장소의 텍스트 파일을 모두 읽어 사이트 하나로 묶는다. 파일마다의 검사에 더해
 * 파일 사이의 연결(글의 카테고리, 네비게이션 대상, 이동 기록)도 검사하고, 문제를 한 번에 모두 돌려준다.
 * 메뉴와 이동 기록이 존재하지 않는 대상을 가리키면 오류다. 대상이 있어도 `now`(기본값은 지금) 시점에 공개되지 않았으면
 * 오류가 아니라 `warnings`로 돌려주고, `visibleNavigation`과 `visibleRedirects`에서 뺀다(#45).
 * 표에 없는 파일(테마, 워크플로, `.gitkeep` 같은 점 파일)은 무시한다.
 */
export function parseSite(files: Iterable<SourceFile>, now: Date = new Date()): Result<Site> {
  const byPath = new Map<string, string>();
  for (const file of files) byPath.set(file.path, file.text);

  const issues: ContentIssue[] = [];
  const collect = <T>(result: Result<T>, into: (value: T) => void) => {
    if (result.ok) into(result.value);
    else issues.push(...result.issues);
  };

  const json: Record<string, unknown> = {};
  for (const key of JSON_KEYS) {
    const codec = blogFiles[key];
    const text = byPath.get(codec.path);
    if (text === undefined) {
      issues.push({
        file: codec.path,
        message: '파일이 없어요. 블로그 템플릿에 있는 기본 파일을 다시 넣어 주세요.',
      });
    } else {
      collect<unknown>(codec.parse(text), (value) => {
        json[key] = value;
      });
    }
    // 스키마 버전이 다르면 다른 파일의 모양도 다를 수 있어 더 읽지 않는다.
    if (key === 'manifest' && issues.length) return { ok: false, issues };
  }

  const posts: Post[] = [];
  const pages: Page[] = [];
  for (const [path, text] of byPath) {
    if (path.split('/').at(-1)?.startsWith('.')) continue;
    if (path.startsWith(`${blogFiles.posts.dir}/`))
      collect(blogFiles.posts.parse(path, text), (post) => posts.push(post));
    else if (path.startsWith(`${blogFiles.pages.dir}/`))
      collect(blogFiles.pages.parse(path, text), (page) => pages.push(page));
  }

  if (issues.length) return { ok: false, issues };
  const base = { ...json, posts, pages } as Omit<
    Site,
    'warnings' | 'visibleNavigation' | 'visibleRedirects'
  >;
  const { issues: links, warnings, hiddenTargets } = linkIssues(base, now);
  if (links.length) return { ok: false, issues: links };
  return {
    ok: true,
    value: {
      ...base,
      warnings,
      visibleNavigation: {
        ...base.navigation,
        items: visibleNavItems(base.navigation.items, hiddenTargets),
      },
      visibleRedirects: base.redirects.items.filter((r) => !hiddenTargets.has(`${r.type}:${r.to}`)),
    },
  };
}

type BaseSite = Omit<Site, 'warnings' | 'visibleNavigation' | 'visibleRedirects'>;

function visibleNavItems(
  items: Navigation['items'],
  hiddenTargets: ReadonlySet<string>,
): Navigation['items'] {
  const shown = (link: NavLink) =>
    link.type === 'home' ||
    link.type === 'external' ||
    !hiddenTargets.has(`${link.type}:${link.slug}`);
  const out: Navigation['items'] = [];
  for (const item of items) {
    if (item.type !== 'group') {
      if (shown(item)) out.push(item);
    } else {
      const children = item.children.filter(shown);
      if (children.length) out.push({ ...item, children });
    }
  }
  return out;
}

function linkIssues(site: BaseSite, now: Date) {
  const issues: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];
  /** `post:slug`처럼 있지만 공개되지 않은 대상 */
  const hiddenTargets = new Set<string>();
  const slugs = {
    post: new Set<string>(site.posts.map((p) => p.slug)),
    page: new Set<string>(site.pages.map((p) => p.slug)),
    category: new Set<string>(),
  };
  // 메뉴와 이동 기록이 가리킬 수 있는 것: 지금 공개된 글과 페이지. 없는 것과 아직 공개되지 않은 것을 구분해 알린다.
  const hidden = {
    post: new Map(
      site.posts
        .filter((p) => postVisibility(p, now) !== 'published')
        .map((p) => [p.slug as string, STATE[postVisibility(p, now)]]),
    ),
    page: new Map(
      site.pages.filter((p) => p.status !== 'published').map((p) => [p.slug as string, '초안']),
    ),
    category: new Map<string, string>(),
  };
  /** 없는 대상은 오류, 공개되지 않은 대상은 경고. 둘 다 아니면 undefined. */
  const check = (
    type: keyof typeof KIND,
    slug: string,
    at: { file: string; field: string },
    prefix: string,
    hint: string,
  ) => {
    const state = hidden[type].get(slug);
    if (state) {
      hiddenTargets.add(`${type}:${slug}`);
      warnings.push({
        ...at,
        message: `${prefix}${KIND[type]} '${slug}'가 아직 공개되지 않았어요(${state}). 공개되기 전까지 ${hint}. 공개하면 다음 빌드부터 나타나요.`,
      });
    } else if (!slugs[type].has(slug)) {
      const reserved = type === 'page' && RESERVED_PAGE_SLUGS.has(slug);
      issues.push({
        ...at,
        message: reserved
          ? `${prefix}페이지 주소 '${slug}'는 블로그가 쓰는 주소라 쓸 수 없어요. 다른 페이지를 고르거나 지워 주세요.`
          : `${prefix}${KIND[type]} '${slug}'가 없어요. 지금 있는 대상을 고르거나 지워 주세요.`,
      });
    }
  };

  site.categories.items.forEach((category, i) => {
    if (slugs.category.has(category.slug))
      issues.push({
        file: blogFiles.categories.path,
        field: `items[${i}].slug`,
        message: `카테고리 주소 '${category.slug}'가 두 번 있어요. 한쪽 주소를 바꿔 주세요.`,
      });
    slugs.category.add(category.slug);
  });

  for (const post of site.posts)
    if (!slugs.category.has(post.category))
      issues.push({
        file: blogFiles.posts.pathFor(post.slug),
        field: 'category',
        message: `category 값 '${post.category}'가 카테고리 목록에 없어요. 카테고리를 고치거나 새로 만든 뒤 다시 배포하세요.`,
      });

  const checkLink = (link: NavLink, field: string) => {
    if (link.type === 'home' || link.type === 'external') return;
    check(
      link.type,
      link.slug,
      { file: blogFiles.navigation.path, field: `${field}.slug` },
      `메뉴 '${link.label}'가 가리키는 `,
      '메뉴에서 숨겨져요',
    );
  };
  site.navigation.items.forEach((item, i) => {
    if (item.type !== 'group') checkLink(item, `items[${i}]`);
    else
      item.children.forEach((child, j) => {
        checkLink(child, `items[${i}].children[${j}]`);
      });
  });

  const seen = new Set<string>();
  site.redirects.items.forEach((redirect, i) => {
    const field = `items[${i}]`;
    const live = slugs[redirect.type];
    const key = `${redirect.type}:${redirect.from}`;
    if (seen.has(key) || live.has(redirect.from))
      issues.push({
        file: blogFiles.redirects.path,
        field: `${field}.from`,
        message: live.has(redirect.from)
          ? `${KIND[redirect.type]} '${redirect.from}'가 지금도 있어서 이동 기록과 겹쳐요. 이 기록을 지워 주세요.`
          : `${KIND[redirect.type]} '${redirect.from}'의 이동 기록이 두 번 있어요. 하나만 남겨 주세요.`,
      });
    if (redirect.type === 'page' && RESERVED_PAGE_SLUGS.has(redirect.from))
      issues.push({
        file: blogFiles.redirects.path,
        field: `${field}.from`,
        message: `페이지 주소 '${redirect.from}'는 블로그가 쓰는 주소라 이동 기록에 쓸 수 없어요. 이 기록을 지워 주세요.`,
      });
    check(
      redirect.type,
      redirect.to,
      { file: blogFiles.redirects.path, field: `${field}.to` },
      '이동할 ',
      '이 이동 페이지는 만들지 않아요',
    );
    seen.add(key);
  });

  return { issues, warnings, hiddenTargets };
}

const STATE = { draft: '초안', review: '검토 중', scheduled: '예약', published: '' } as const;
const KIND = { post: '글', page: '페이지', category: '카테고리' } as const;
