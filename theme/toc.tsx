'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from './types';

export interface TocProps {
  label?: string;
  items: TocItem[];
}

// 읽는 위치의 제목을 current로 바꾼다. 이 테마에서 유일하게 스크롤을 읽는 JS다.
function useCurrentId(items: TocItem[]) {
  const [current, setCurrent] = useState(items.find((i) => i.current)?.id);
  useEffect(() => {
    const update = () => {
      let id = items[0]?.id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 120) id = item.id;
      }
      setCurrent(id);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [items]);
  return current;
}

/**
 * 넓은 화면에서는 세로선 목차, 좁은 화면에서는 본문 위에 접힌 상자가 된다.
 * h2가 2개 미만이면 그리지 않는다.
 */
export function Toc({ label = '목차', items }: TocProps) {
  const current = useCurrentId(items);
  if (items.filter((i) => (i.depth ?? 2) === 2).length < 2) return null;
  const links = items.map((item) => (
    <a
      key={item.id}
      href={`#${item.id}`}
      aria-current={item.id === current ? 'location' : undefined}
      className={`py-1.5 pr-3 text-small text-fg-muted no-underline aria-[current=location]:-ml-px aria-[current=location]:border-l-2 aria-[current=location]:border-fg-default aria-[current=location]:font-semibold aria-[current=location]:text-fg-default ${
        item.depth === 3 ? 'pl-6' : 'pl-3'
      }`}
    >
      {item.label}
    </a>
  ));
  return (
    <>
      <nav
        aria-label="이 글의 목차"
        className="flex w-toc max-w-full flex-col gap-2 max-[1099px]:hidden"
      >
        <span className="text-label text-fg-subtle">{label}</span>
        <div className="flex flex-col border-l border-stroke-default">{links}</div>
      </nav>
      <details className="rounded-lg bg-bg-subtle min-[1100px]:hidden">
        <summary className="cursor-pointer px-4 py-3 text-meta text-fg-default">{label}</summary>
        <nav aria-label="이 글의 목차" className="flex flex-col px-4 pb-3">
          {links}
        </nav>
      </details>
    </>
  );
}
