import Link from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

/**
 * 사이트 안 경로(/로 시작)는 Next 링크로 그려 basePath를 자동으로 붙인다.
 * GitHub Pages 프로젝트 사이트는 /저장소이름 아래에서 열리므로 a 태그에 경로를 그대로 쓰면 깨진다.
 */
export function ThemeLink({
  href,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  if (href.startsWith('/') && !href.startsWith('//')) return <Link href={href} {...rest} />;
  return <a href={href} {...rest} />;
}
