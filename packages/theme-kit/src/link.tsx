import NextLink from 'next/link';
import type { AnchorHTMLAttributes, ReactElement } from 'react';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * 사이트 안 경로(`/`로 시작)는 Next 링크로 그려 기준 경로를 붙이고, 바깥 주소는 `<a>`로 그린다.
 * GitHub Pages 프로젝트 사이트는 `/저장소` 아래에서 열려서 `<a>`에 경로를 그대로 쓰면 깨진다.
 */
export function Link({ href, ...rest }: LinkProps): ReactElement {
  if (href.startsWith('/') && !href.startsWith('//')) return <NextLink href={href} {...rest} />;
  return <a href={href} {...rest} />;
}
