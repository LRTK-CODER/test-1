import { themeCssVariables } from '@lbs/schema';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { loadBlog } from '../src/blog';
import '../globals.css';

export function generateMetadata(): Metadata {
  const { info } = loadBlog().site;
  return {
    title: { default: info.name, template: `%s · ${info.name}` },
    description: info.description ?? info.tagline,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const { site } = loadBlog();
  // theme/tokens.json(CMS 테마 화면이 바꾸는 값)을 CSS 변수로 옮긴다. :root:root로 tokens.css의 기본값을 덮는다.
  const vars = Object.entries(themeCssVariables(site.theme))
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
