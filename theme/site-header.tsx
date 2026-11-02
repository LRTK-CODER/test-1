'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { IconButton } from './icon-button';
import { ThemeLink } from './link';
import type { NavLink } from './types';

export interface SiteHeaderProps {
  siteName: string;
  logoSrc?: string;
  homeHref?: string;
  nav?: NavLink[];
  /** 검색 버튼을 보일지. 기본은 보인다. */
  searchable?: boolean;
  /** dark면 글자를 흰색으로. auto는 아래 어두운 구역(data-header-tone="dark")을 읽어 바꾼다. */
  tone?: 'auto' | 'dark';
  /** 이 값(px)을 넘게 스크롤하면 알약으로 접힌다. */
  threshold?: number;
  /** 접힘 상태를 고정한다(미리보기·테스트용) */
  collapsed?: boolean;
  /** static이면 화면 위에 고정하지 않는다(미리보기·테스트용) */
  position?: 'fixed' | 'static';
  onSearch?: () => void;
}

// 헤더 한가운데(38px)에 어두운 구역이 걸려 있는지, 스크롤 위치로 읽는다.
function useOverDarkSection(enabled: boolean) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const over = [...document.querySelectorAll('[data-header-tone="dark"]')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= 38 && r.bottom >= 38;
      });
      setDark(over);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);
  return dark;
}

// 스크롤 위치는 React 밖에 있는 값이라 useSyncExternalStore로 읽는다. 하이드레이션 직후에 구독을 시작하면서
// 그 사이에 바뀐 위치를 다시 읽고, 처음 그릴 때는 펼친 상태(false)로 서버 HTML과 맞춘다.
// 브라우저가 스크롤 위치를 복원하거나(pageshow) 스크롤이 끝났을 때(scrollend)도 다시 읽어, 스크롤 이벤트를 놓쳐도 어긋나지 않게 한다.
function subscribeScroll(onChange: () => void) {
  const events = ['scroll', 'scrollend', 'resize', 'pageshow'] as const;
  for (const name of events) window.addEventListener(name, onChange, { passive: true });
  return () => {
    for (const name of events) window.removeEventListener(name, onChange);
  };
}

function useScrolled(threshold: number) {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}

function Mark({ siteName, logoSrc }: Pick<SiteHeaderProps, 'siteName' | 'logoSrc'>) {
  if (logoSrc) {
    // biome-ignore lint/performance/noImgElement: 정적 내보내기에서는 이미지 최적화를 쓰지 않는다
    return <img src={logoSrc} alt="" className="size-8 flex-none rounded-md object-contain" />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 flex-none items-center justify-center rounded-md bg-(--header-fg) text-[17px] font-extrabold text-(--mark-fg)"
    >
      {siteName.trim().charAt(0) || '?'}
    </span>
  );
}

function newTabProps({ newTab }: { newTab?: boolean }) {
  return newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

function NavItem({ item }: { item: NavLink }) {
  const [open, setOpen] = useState(false);
  const link =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-menu leading-5 text-(--header-fg) no-underline cursor-pointer border-0 bg-transparent font-[inherit] hover:bg-bg-subtle group-data-[tone=dark]:hover:bg-bg-nav-pill-on-dark';
  if (!item.children) {
    return (
      <ThemeLink
        href={item.href ?? '#'}
        aria-current={item.current ? 'page' : undefined}
        {...newTabProps(item)}
        className={`${link} aria-[current=page]:font-bold`}
      >
        {item.label}
      </ThemeLink>
    );
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 마우스를 올려 드롭다운을 여는 편의 동작이고, 키보드는 안쪽 버튼이 맡는다
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${link} aria-expanded:bg-bg-subtle`}
      >
        {item.label}
        <ChevronDown aria-hidden="true" size={10} strokeWidth={3} />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+8px)] left-0 flex min-w-[200px] animate-drop flex-col rounded-lg bg-bg-floating p-1.5">
          {item.children.map((child) => (
            <ThemeLink
              key={child.label}
              href={child.href ?? '#'}
              {...newTabProps(child)}
              className="rounded-md px-3 py-2.5 text-meta text-fg-default no-underline hover:bg-bg-subtle"
            >
              {child.label}
            </ThemeLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface MobileMenuProps {
  siteName: string;
  logoSrc?: string;
  homeHref?: string;
  nav?: NavLink[];
  onClose: () => void;
  /** 화면 전체를 덮지 않고 제자리에 그린다(미리보기·테스트용) */
  static?: boolean;
}

export function MobileMenu({
  siteName,
  logoSrc,
  homeHref = '/',
  nav,
  onClose,
  static: isStatic,
}: MobileMenuProps) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="메뉴"
      className={`flex animate-drop flex-col bg-bg-article text-fg-default ${
        isStatic ? 'relative min-h-[420px]' : 'fixed inset-0 z-1100'
      }`}
    >
      <div className="flex h-16 items-center justify-between pr-4 pl-5">
        <ThemeLink
          href={homeHref}
          className="flex items-center gap-2 text-[20px] leading-7 font-bold tracking-[-0.03em] whitespace-nowrap text-fg-default no-underline [--header-fg:var(--fg-default)] [--mark-fg:var(--bg-article)]"
        >
          <Mark siteName={siteName} logoSrc={logoSrc} />
          {siteName}
        </ThemeLink>
        <IconButton icon="close" label="메뉴 닫기" onClick={onClose} />
      </div>
      <nav aria-label="주 메뉴" className="flex flex-col px-6 py-4">
        {nav?.map((item) => {
          const row =
            'flex w-full cursor-pointer items-center justify-between border-0 bg-transparent py-2.5 text-left font-[inherit] text-[21px] leading-[30px] text-fg-default no-underline';
          if (!item.children) {
            return (
              <ThemeLink
                key={item.label}
                href={item.href ?? '#'}
                aria-current={item.current ? 'page' : undefined}
                {...newTabProps(item)}
                className={`${row} aria-[current=page]:font-bold`}
              >
                {item.label}
              </ThemeLink>
            );
          }
          const open = openLabel === item.label;
          return (
            <div key={item.label}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenLabel(open ? null : item.label)}
                className={row}
              >
                {item.label}
                <ChevronDown
                  aria-hidden="true"
                  size={16}
                  strokeWidth={2.4}
                  className={open ? 'rotate-180' : undefined}
                />
              </button>
              {open ? (
                <div className="flex flex-col pb-2 pl-4">
                  {item.children.map((child) => (
                    <ThemeLink
                      key={child.label}
                      href={child.href ?? '#'}
                      {...newTabProps(child)}
                      className="py-2 text-[17px] leading-[26px] text-fg-muted no-underline"
                    >
                      {child.label}
                    </ThemeLink>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * 맨 위에서는 너비 전체에 펼쳐진 막대, 80px 넘게 스크롤하면 가운데로 모인 알약이 된다.
 * 그리드 열의 비율을 바꿔 모으고, 알약은 높이·배경·블러가 함께 바뀐다.
 * 968px 미만에서는 마크와 이름, 검색·메뉴 버튼만 두고(헤더 자신의 너비로 판단), 스크롤 뒤에는
 * 같은 높이 안에서 불투명한 알약 막대로 모여 본문 글자가 비치지 않게 한다.
 */
export function SiteHeader({
  siteName,
  logoSrc,
  homeHref = '/',
  nav,
  searchable = true,
  tone = 'auto',
  threshold = 80,
  collapsed,
  position = 'fixed',
  onSearch,
}: SiteHeaderProps) {
  const scrolled = useScrolled(threshold);
  const overDark = useOverDarkSection(tone === 'auto');
  const [menuOpen, setMenuOpen] = useState(false);
  const isCollapsed = collapsed ?? scrolled;
  const resolvedTone = tone === 'dark' || overDark ? 'dark' : 'auto';
  const motion = 'transition-all duration-(--duration-morph) ease-emphasized';

  return (
    <>
      <header
        data-collapsed={isCollapsed}
        data-tone={resolvedTone}
        className={`group @container top-0 inset-x-0 z-1000 [--btn-bg:var(--bg-subtle)] [--header-fg:var(--fg-default)] [--mark-fg:var(--bg-page)] [--bar-bg:var(--bg-page)] [--bar-stroke:var(--stroke-subtle)] [--pill-bg:var(--bg-nav-pill)] data-[tone=dark]:[--btn-bg:var(--bg-nav-pill-on-dark)] data-[tone=dark]:[--bar-bg:var(--bg-media)] data-[tone=dark]:[--bar-stroke:var(--bg-nav-pill-on-dark)] data-[tone=dark]:[--header-fg:var(--fg-on-dark)] data-[tone=dark]:[--mark-fg:var(--bg-media)] data-[tone=dark]:[--pill-bg:var(--bg-nav-pill-on-dark)] ${
          position === 'static' ? 'relative' : 'fixed'
        }`}
      >
        <div className="mx-auto grid h-[76px] max-w-[97rem] grid-cols-[0fr_auto_1fr_auto_1fr_auto_0fr] items-center px-4 text-(--header-fg) transition-[grid-template-columns] duration-(--duration-morph) ease-emphasized group-data-[collapsed=true]:grid-cols-[1fr_auto_0fr_auto_0fr_auto_1fr] @max-[968px]:hidden">
          <div
            aria-hidden="true"
            className={`col-[2/7] row-1 h-0 rounded-full bg-transparent backdrop-blur-none group-data-[collapsed=true]:-mx-6 group-data-[collapsed=true]:h-[58px] group-data-[collapsed=true]:bg-(--pill-bg) group-data-[collapsed=true]:backdrop-blur-[60px] ${motion}`}
          />
          <ThemeLink
            href={homeHref}
            aria-label={siteName}
            className="relative col-2 row-1 flex items-center gap-2 text-site-name whitespace-nowrap text-(--header-fg) no-underline"
          >
            <Mark siteName={siteName} logoSrc={logoSrc} />
            <span
              className={`inline-block max-w-60 overflow-hidden opacity-100 group-data-[collapsed=true]:max-w-0 group-data-[collapsed=true]:opacity-0 ${motion}`}
            >
              {siteName}
            </span>
          </ThemeLink>
          <nav aria-label="주 메뉴" className="relative col-4 row-1 mx-6 flex gap-0.5">
            {nav?.map((item) => (
              <NavItem key={item.label} item={item} />
            ))}
          </nav>
          <div className="relative col-6 row-1 flex gap-2">
            {searchable ? (
              <IconButton
                icon="search"
                label="검색"
                onClick={onSearch}
                className="bg-transparent! text-(--header-fg)! hover:bg-bg-subtle!"
              />
            ) : null}
          </div>
        </div>
        <div
          className={`hidden h-16 items-center justify-between rounded-full border border-transparent pr-4 pl-5 text-(--header-fg) group-data-[collapsed=true]:mx-3 group-data-[collapsed=true]:mt-2 group-data-[collapsed=true]:h-14 group-data-[collapsed=true]:border-(--bar-stroke) group-data-[collapsed=true]:bg-(--bar-bg) group-data-[collapsed=true]:pr-2 group-data-[collapsed=true]:pl-3 @max-[968px]:flex ${motion}`}
        >
          <ThemeLink
            href={homeHref}
            className="flex items-center gap-2 text-[20px] leading-7 font-bold tracking-[-0.03em] whitespace-nowrap text-(--header-fg) no-underline"
          >
            <Mark siteName={siteName} logoSrc={logoSrc} />
            {siteName}
          </ThemeLink>
          <div className="flex gap-2">
            {searchable ? (
              <IconButton
                icon="search"
                label="검색"
                onClick={onSearch}
                className="bg-(--btn-bg)! text-(--header-fg)!"
              />
            ) : null}
            <IconButton
              icon="menu"
              label="메뉴"
              onClick={() => setMenuOpen(true)}
              className="bg-(--btn-bg)! text-(--header-fg)!"
            />
          </div>
        </div>
      </header>
      {/* @container는 fixed 자손의 기준 상자가 되므로 메뉴는 헤더 밖에 그린다 */}
      {menuOpen ? (
        <MobileMenu
          siteName={siteName}
          logoSrc={logoSrc}
          homeHref={homeHref}
          nav={nav}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </>
  );
}
