/**
 * 테마 계약: 컴포넌트를 고쳐도 아래 이름과 속성은 유지한다.
 * 블로그 빌드가 이 모양으로 콘텐츠를 넘긴다.
 */

export interface NavLink {
  label: string;
  href?: string;
  current?: boolean;
  /** 새 탭에서 연다(외부 링크) */
  newTab?: boolean;
  children?: { label: string; href?: string; newTab?: boolean }[];
}

export interface PostSummary {
  href?: string;
  title: string;
  category: string;
  date: string;
  readingTime?: string;
  excerpt?: string;
  image?: string;
}

export interface TocItem {
  id: string;
  label: string;
  depth?: 2 | 3;
  current?: boolean;
}
