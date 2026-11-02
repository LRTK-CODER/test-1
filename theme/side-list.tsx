import { ThemeLink } from './link';
import type { NavLink } from './types';

export interface SideListProps {
  label: string;
  groups: { label: string; items: NavLink[] }[];
}

/** 글 상세 왼쪽에서 같은 카테고리의 다른 글과 다른 카테고리로 이동한다. */
export function SideList({ label, groups }: SideListProps) {
  return (
    <nav aria-label={label} className="flex w-sidebar max-w-full flex-col gap-0.5 text-meta">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className="px-2.5 pt-2.5 pb-1.5 text-label text-fg-subtle">{group.label}</span>
          {group.items.map((item) => (
            <ThemeLink
              key={item.label}
              href={item.href ?? '#'}
              aria-current={item.current ? 'page' : undefined}
              className="rounded-md p-2.5 text-fg-default no-underline hover:bg-bg-subtle aria-[current=page]:bg-bg-subtle"
            >
              {item.label}
            </ThemeLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
