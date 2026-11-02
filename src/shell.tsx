import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '../theme';
import type { Blog } from './blog';
import { type CurrentRoute, navLinks } from './views';

export interface ShellProps {
  blog: Blog;
  current?: CurrentRoute;
  /** page는 홈·목록의 바탕, article은 글 읽기의 바탕 */
  surface?: 'page' | 'article';
  children: ReactNode;
}

/** 모든 화면의 공통 틀: 머리말, 본문, 바닥글. 검색은 MVP에 없어 검색 버튼을 숨긴다(#36). */
export function Shell({ blog, current, surface = 'page', children }: ShellProps) {
  const { info } = blog.site;
  const year = new Intl.DateTimeFormat('en', { timeZone: info.timeZone, year: 'numeric' }).format(
    blog.now,
  );
  return (
    <div className={`min-h-screen ${surface === 'page' ? 'bg-bg-page' : 'bg-bg-article'}`}>
      {/* 스크립트가 없는 미리보기는 헤더가 본문과 함께 스크롤된다. 고정일 때와 같은 자리에서 시작하도록 헤더 높이만큼 당긴다. */}
      <div className={blog.scriptless ? '-mb-16 min-[968px]:-mb-[76px]' : undefined}>
        <SiteHeader
          siteName={info.name}
          homeHref="/"
          nav={navLinks(blog, current)}
          searchable={false}
          position={blog.scriptless ? 'static' : 'fixed'}
        />
      </div>
      {children}
      <SiteFooter copyright={`© ${year} ${info.name}`} />
    </div>
  );
}
