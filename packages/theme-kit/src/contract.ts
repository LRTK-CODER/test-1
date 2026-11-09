/**
 * 테마 계약 1.0: 블로그 템플릿이 테마에 넘기는 화면별 값과 테마가 내보내는 화면.
 *
 * - 화면이 받는 값은 모두 JSON으로 옮길 수 있다(함수, React 요소, `Date` 없음). `LayoutProps.children`만 예외다.
 *   그래서 블로그 빌드(Next)와 CMS 미리보기가 같은 값을 받는다.
 * - 화면은 props만 보고 같은 결과를 내는 동기 함수다. 파일, 환경 변수, 지금 시각을 읽지 않는다.
 * - 계약 버전은 `THEME_CONTRACT`(manifest.ts)다. 값을 더하면 minor, 지우거나 뜻을 바꾸면 major를 올린다.
 */
import type { Root } from 'hast';
import type { ReactElement, ReactNode } from 'react';
import type { SettingValue } from './manifest';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface SiteData {
  name: string;
  tagline?: string;
  description?: string;
  /** `ko`, `en-US` 같은 언어 코드 */
  language: string;
  /** IANA 시간대 이름 */
  timeZone: string;
  /** `© 2026 사이트 이름`. 연도는 빌드 시각의 사이트 시간대 연도다 */
  copyright: string;
  /** 피드(`feed.xml`)의 절대 주소. 사이트 주소를 모르는 빌드에서는 없다 */
  feedUrl?: string;
  /** `content/site.json`에 테마가 더 넣은 항목 */
  extra: Record<string, Json>;
}

/** `src`는 기준 경로까지 붙은 최종 주소다. 그대로 `<img src>`에 쓴다. */
export interface ImageData {
  src: string;
  alt: string;
}

/** `href`는 기준 경로 없는 사이트 안 경로(`/posts/x/`)이거나 바깥 주소다. `Link`로 그린다. */
export interface LinkData {
  label: string;
  href: string;
  /** 새 탭에서 연다(바깥 링크) */
  newTab?: boolean;
  /** 지금 보고 있는 화면 */
  current?: boolean;
}

/** 머리말 메뉴. 공개된 대상만 들어 있다. */
export type NavItem =
  | ({ kind: 'link' } & LinkData)
  | { kind: 'group'; label: string; children: LinkData[] };

export interface CategoryRef {
  slug: string;
  name: string;
  href: string;
}

export interface CategoryData extends CategoryRef {
  /** 공개된 글 수 */
  postCount: number;
  current?: boolean;
}

export interface PostSummary {
  slug: string;
  href: string;
  title: string;
  summary?: string;
  author?: string;
  category: CategoryRef;
  tags: string[];
  /** 발행 시각(ISO 8601) */
  publishedAt: string;
  /** 사이트 언어와 시간대로 쓴 날짜. 올해 글은 연도를 뺀다 */
  date: string;
  /** 연도를 늘 붙인 날짜 */
  dateLong: string;
  /** `3분`, `3 min` */
  readingTime: string;
  cover?: ImageData;
  /** front matter의 `featured: true` */
  featured: boolean;
  /** front matter에 테마가 더 넣은 항목 */
  extra: Record<string, Json>;
}

export interface TocItem {
  id: string;
  label: string;
  depth: 2 | 3;
}

/**
 * 본문. Markdown을 HTML 트리로 바꾸고 허용한 태그·속성만 남긴 뒤(정리), 제목 id와 기준 경로까지 붙인 hast(JSON)다.
 * `Content`로 그린다.
 */
export interface BodyData {
  tree: Root;
  /** h2 목차 */
  toc: TocItem[];
}

export interface PostDetail extends PostSummary {
  body: BodyData;
}

export interface PageDetail {
  slug: string;
  href: string;
  title: string;
  summary?: string;
  body: BodyData;
  extra: Record<string, Json>;
}

/** 템플릿이 쪽 나누기를 하기 전에는 늘 1쪽이다. */
export interface Pagination {
  /** 1부터 */
  page: number;
  totalPages: number;
  prevHref?: string;
  nextHref?: string;
}

export type Route =
  | { type: 'home' }
  | { type: 'category'; slug: string }
  | { type: 'post'; slug: string }
  | { type: 'page'; slug: string }
  | { type: 'not-found' };

/** 모든 화면이 받는 값 */
export interface CommonProps {
  site: SiteData;
  nav: NavItem[];
  /** 공개된 글이 있는 카테고리. `content/categories.json` 순서 */
  categories: CategoryData[];
  /** 테마 설정 값. `theme.json`의 정의대로 검사하고 기본값을 채웠다 */
  settings: Readonly<Record<string, SettingValue>>;
  route: Route;
  /** CMS 미리보기 안에서 그릴 때 true. 표시를 바꾸는 데만 쓴다 */
  preview: boolean;
}

export interface LayoutProps extends CommonProps {
  /** `list`는 홈·목록의 바탕, `article`은 글 읽기의 바탕 */
  surface: 'list' | 'article';
  /** 화면(Home, Post 등)이 그린 것 */
  children: ReactNode;
}

/** 홈과 카테고리 */
export interface ListProps extends CommonProps {
  route: { type: 'home' } | { type: 'category'; slug: string };
  /** 홈은 tagline(없으면 사이트 이름), 카테고리는 카테고리 이름 */
  title: string;
  /** 홈은 사이트 description */
  lead?: string;
  /** 카테고리 화면일 때만. 공개된 글이 없는 카테고리도 있다 */
  category?: CategoryData;
  /** 홈에서만. `featured: true`인 가장 최근 글, 없으면 가장 최근 글 */
  featured?: PostSummary;
  /** `featured`를 뺀 공개 글, 최신순 */
  posts: PostSummary[];
  pagination: Pagination;
}

export interface PostProps extends CommonProps {
  route: { type: 'post'; slug: string };
  post: PostDetail;
  /** 같은 카테고리 먼저, 태그가 겹치는 글로 채운다. 최대 4개 */
  related: PostSummary[];
  /** 같은 카테고리의 공개 글(이 글 포함), 최신순 */
  sameCategory: PostSummary[];
  /** 바로 앞에 발행한 글 */
  previous?: PostSummary;
  /** 바로 뒤에 발행한 글 */
  next?: PostSummary;
  /** `url`은 절대 주소. 사이트 주소를 모르면 없다 */
  share: { url?: string; title: string; text?: string };
}

export interface PageProps extends CommonProps {
  route: { type: 'page'; slug: string };
  page: PageDetail;
}

export interface NotFoundProps extends CommonProps {
  route: { type: 'not-found' };
  /** `content/pages/404.md`가 있으면 그 내용 */
  page?: PageDetail;
}

/** 화면은 props만 보고 그리는 동기 컴포넌트다. async 컴포넌트는 반환 타입이 맞지 않아 타입 오류가 난다. */
export type Screen<P> = (props: P) => ReactElement | null;

export interface Theme {
  Layout: Screen<LayoutProps>;
  Home: Screen<ListProps>;
  Post: Screen<PostProps>;
  Page: Screen<PageProps>;
  /** 없으면 Home으로 그린다 */
  Category?: Screen<ListProps>;
  /** 없으면 Page로 그린다(제목과 문구는 템플릿 기본) */
  NotFound?: Screen<NotFoundProps>;
}

/** 테마의 `index.tsx`가 `export default defineTheme({ ... })`로 쓴다. 빠진 화면은 타입 오류가 된다. */
export function defineTheme(theme: Theme): Theme {
  return theme;
}
