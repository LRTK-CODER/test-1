/**
 * 부품이 받는 속성. 템플릿 0.1의 `theme/` 부품과 이름과 모양이 같다.
 * 화면(`screens/`)이 테마 계약의 값을 이 모양으로 바꿔 넘긴다.
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
