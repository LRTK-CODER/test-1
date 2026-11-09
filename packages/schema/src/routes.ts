import { ContentError } from './issues';
import type { NavLink, Redirect } from './schemas';
import type { Slug } from './slug';

/** 블로그 안의 주소 하나. 경로 모양은 `routePath`가 한 곳에서 정한다. */
export type Route = { type: 'home' } | { type: 'post' | 'category' | 'page'; slug: Slug };

/** 블로그 템플릿이 피드와 사이트맵을 내보내는 사이트 안의 경로. CMS가 같은 주소를 보여 준다. */
export const FEED_PATH = '/feed.xml';
export const SITEMAP_PATH = '/sitemap.xml';

/** `''` 또는 `/저장소-이름`처럼 `/`로 시작하고 `/`로 끝나지 않는 값. */
export type BasePath = string & { readonly __brand: 'BasePath' };

/** GitHub 저장소 이름에 쓸 수 있는 글자. `.`과 `..`는 경로 조작이라 뺀다. */
const REPO_NAME = /^(?!\.{1,2}$)[A-Za-z0-9._-]+$/;

/**
 * `repo`, `/repo/`, `/`, 빈 값을 모두 받아 `/repo` 또는 `''`로 맞춘다.
 * 저장소 이름이 아닌 값(`https://x.io/repo`, `../x`, `a/b`)은 ContentError를 던진다.
 */
export function normalizeBasePath(input: string | undefined): BasePath {
  const trimmed = (input ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (trimmed && !REPO_NAME.test(trimmed))
    throw new ContentError([
      {
        file: 'basePath',
        message: `basePath '${input}'는 저장소 이름이어야 해요. 영문, 숫자, -, _, .만 쓰고 /나 주소는 빼 주세요(예: dev-notes).`,
      },
    ]);
  return (trimmed ? `/${trimmed}` : '') as BasePath;
}

/** `https://owner.github.io`처럼 주소 맨 앞(scheme과 host). 경로와 끝의 `/`가 없다. */
export type SiteOrigin = string & { readonly __brand: 'SiteOrigin' };

/**
 * 사이트 주소의 맨 앞을 `https://host` 모양으로 맞춘다. 빈 값은 undefined다.
 * 경로, 쿼리, 해시가 붙은 값(`https://x.io/repo`)은 기준 경로(basePath)와 섞이므로 ContentError를 던진다.
 */
export function normalizeSiteOrigin(input: string | undefined): SiteOrigin | undefined {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return undefined;
  let url: URL | undefined;
  try {
    url = new URL(trimmed);
  } catch {}
  if (
    !url ||
    !/^https?:$/.test(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username
  )
    throw new ContentError([
      {
        file: 'siteOrigin',
        message: `사이트 주소 '${input}'는 https://owner.github.io처럼 주소의 맨 앞만 써야 해요. 경로(/저장소)는 basePath로 따로 받아요.`,
      },
    ]);
  return url.origin as SiteOrigin;
}

/** GitHub Pages가 `owner/repo` 저장소에 주는 주소의 맨 앞. 사용자 사이트와 프로젝트 사이트 모두 `https://owner.github.io`다. */
export function pagesOrigin(repository: string | undefined): SiteOrigin | undefined {
  const owner = /^([A-Za-z0-9-]+)\/[A-Za-z0-9._-]+$/.exec((repository ?? '').trim())?.[1];
  return owner ? (`https://${owner.toLowerCase()}.github.io` as SiteOrigin) : undefined;
}

/** 사이트 안의 경로(`/media/…`, `/posts/x/`)를 공유 미리보기와 피드가 쓰는 절대 주소로 만든다. */
export function absoluteUrl(origin: SiteOrigin, basePath: BasePath, path: string): string {
  return `${origin}${withBasePath(path, basePath)}`;
}

const PREFIX = { post: '/posts/', category: '/category/', page: '/' } as const;

/** basePath 없이 사이트 안의 경로를 만든다. next/link는 basePath를 스스로 붙이므로 이 값을 넘긴다. */
export function routePath(route: Route): string {
  return route.type === 'home' ? '/' : `${PREFIX[route.type]}${route.slug}/`;
}

/** basePath를 붙인 실제 주소. `<a>`, `<img>`의 미디어 경로, 이동 페이지, CMS의 "주소 복사"처럼 Next.js가 basePath를 붙여 주지 않는 곳에 쓴다. */
export function withBasePath(path: string, basePath: BasePath): string {
  return `${basePath}${path}`;
}

/** 네비게이션 항목의 주소. 외부 링크는 그대로, 사이트 안의 링크는 basePath를 붙인다. */
export function navHref(link: NavLink, basePath: BasePath): string {
  return link.type === 'external' ? link.url : withBasePath(routePath(link), basePath);
}

export interface RedirectStub {
  /** 빌드 결과물(`out/`) 안에 만들 파일. 예: `posts/old-slug/index.html` */
  file: string;
  /** 이동할 주소(basePath 포함). `<meta http-equiv="refresh">`와 `rel=canonical`에 쓴다. */
  to: string;
}

export function redirectStubs(redirects: readonly Redirect[], basePath: BasePath): RedirectStub[] {
  return redirects.map(({ type, from, to }) => ({
    file: `${routePath({ type, slug: from }).slice(1)}index.html`,
    to: withBasePath(routePath({ type, slug: to }), basePath),
  }));
}

/**
 * 주소를 바꿀 때 이동 기록을 더한다. 같은 결과로 수렴하므로 여러 번 불러도 된다.
 * - 옛 주소로 가던 기록은 새 주소로 바로 가게 고친다(A→B, B→C면 A→C).
 * - 새 주소가 다시 살아난 주소면 그 주소에서 나가던 기록을 지운다.
 */
export function addRedirect(redirects: readonly Redirect[], next: Redirect): Redirect[] {
  const same = (r: Redirect) => r.type === next.type;
  const kept = redirects
    .filter((r) => !(same(r) && (r.from === next.to || r.from === next.from)))
    .map((r) => (same(r) && r.to === next.from ? { ...r, to: next.to } : r))
    .filter((r) => r.from !== r.to);
  return next.from === next.to ? kept : [...kept, next];
}
