import type { LayoutProps, NavItem } from '@lbs/theme-kit';
import { type NavLink, SiteFooter, SiteHeader } from '../parts';

function navLinks(nav: NavItem[]): NavLink[] {
  return nav.map((item) =>
    item.kind === 'group'
      ? {
          label: item.label,
          children: item.children.map(({ label, href, newTab }) => ({ label, href, newTab })),
        }
      : { label: item.label, href: item.href, newTab: item.newTab, current: item.current },
  );
}

/** 모든 화면의 공통 틀: 머리말, 본문, 바닥글. 검색은 MVP에 없어 검색 버튼을 숨긴다(#36). */
export function Layout({ site, nav, surface, preview, children }: LayoutProps) {
  return (
    <div className={`min-h-screen ${surface === 'list' ? 'bg-bg-page' : 'bg-bg-article'}`}>
      {/* 스크립트가 없는 미리보기는 헤더가 본문과 함께 스크롤된다. 고정일 때와 같은 자리에서 시작하도록 헤더 높이만큼 당긴다. */}
      <div className={preview ? '-mb-16 min-[968px]:-mb-[76px]' : undefined}>
        <SiteHeader
          siteName={site.name}
          homeHref="/"
          nav={navLinks(nav)}
          searchable={false}
          position={preview ? 'static' : 'fixed'}
        />
      </div>
      {children}
      <SiteFooter copyright={site.copyright} />
    </div>
  );
}
