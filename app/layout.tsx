import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { loadTheme } from '../src/active-theme';
import { loadBlog } from '../src/blog';
import { FEED_TYPE, feedAlternate } from '../src/feed';
import '../globals.css';

export function generateMetadata(): Metadata {
  const blog = loadBlog();
  const { info } = blog.site;
  const feed = feedAlternate(blog);
  return {
    title: { default: info.name, template: `%s · ${info.name}` },
    description: info.description ?? info.tagline,
    alternates: feed ? { types: { [FEED_TYPE]: [feed] } } : undefined,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const { site } = loadBlog();
  // 테마 설정(content/theme.json) 중 CSS 변수로 내는 값. :root:root로 테마 CSS의 기본값을 덮는다.
  const vars = Object.entries(loadTheme().cssVariables)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  return (
    <html lang={site.info.language}>
      <head>
        <style>{`:root:root{${vars}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
