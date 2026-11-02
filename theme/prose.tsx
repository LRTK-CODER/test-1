import type { ReactNode } from 'react';

export interface ProseProps {
  /** Markdown을 빌드에서 HTML로 바꾼 결과 */
  html?: string;
  children?: ReactNode;
}

/** 본문 스타일은 theme.css의 .lbs-prose가 입힌다. html은 빌드가 만든 믿을 수 있는 값이어야 한다. */
export function Prose({ html, children }: ProseProps) {
  if (html !== undefined) {
    // biome-ignore lint/security/noDangerouslySetInnerHtml: 빌드 단계에서 Markdown을 변환한 결과를 넣는 자리다
    return <div className="lbs-prose" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className="lbs-prose">{children}</div>;
}

export interface CalloutProps {
  title?: string;
  children: ReactNode;
}

export function Callout({ title = '참고', children }: CalloutProps) {
  return (
    <aside
      role="note"
      className="flex gap-3 rounded-lg bg-bg-informative-weak px-4 py-3.5 text-[15px] leading-6"
    >
      <strong className="flex-none font-bold text-fg-informative">{title}</strong>
      <span>{children}</span>
    </aside>
  );
}
