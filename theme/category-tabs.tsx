import { ThemeLink } from './link';
import type { NavLink } from './types';

export interface CategoryTabsProps {
  label?: string;
  items: NavLink[];
}

/** 정적 사이트라 탭은 링크다. 같은 페이지 안에서 걸러 보지 않는다. */
export function CategoryTabs({ label = '카테고리', items }: CategoryTabsProps) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-6 border-b border-stroke-subtle">
      {items.map((item) => (
        <ThemeLink
          key={item.label}
          href={item.href ?? '#'}
          aria-current={item.current ? 'page' : undefined}
          className="-mb-px border-b-2 border-transparent pb-2.5 text-menu text-fg-subtle no-underline hover:text-fg-default aria-[current=page]:border-fg-default aria-[current=page]:text-fg-default"
        >
          {item.label}
        </ThemeLink>
      ))}
    </nav>
  );
}
