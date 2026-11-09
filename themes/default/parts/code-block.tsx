'use client';

import { IconButton } from './icon-button';

export interface CodeBlockProps {
  code: string;
  language?: string;
  /** 있으면 윗줄에 파일 이름, 없으면 언어를 보인다 */
  filename?: string;
}

/** 구문 강조 색은 아직 정하지 않았다. 정할 때 두 테마 모두 4.5:1을 지킨다. */
export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-stroke-subtle bg-bg-article">
      <figcaption className="flex items-center justify-between border-b border-stroke-subtle py-2.5 pr-3 pl-4 text-small text-fg-muted">
        <span>{filename ?? language}</span>
        <IconButton
          icon="copy"
          label="코드 복사"
          variant="plain"
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => {});
          }}
        />
      </figcaption>
      <pre className="m-0 overflow-x-auto bg-bg-code p-5 font-mono text-code text-fg-default">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
