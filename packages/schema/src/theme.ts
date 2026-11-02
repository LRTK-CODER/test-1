import type { BodyFont, ThemeTokens } from './schemas';

export const BODY_FONTS: Record<BodyFont, { label: string; stack: string }> = {
  system: {
    label: '시스템 + Pretendard',
    stack:
      '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Pretendard, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
  },
  'noto-sans-kr': { label: 'Noto Sans KR', stack: '"Noto Sans KR", sans-serif' },
  'ibm-plex-sans-kr': { label: 'IBM Plex Sans KR', stack: '"IBM Plex Sans KR", sans-serif' },
};

/** 테마 토큰을 블로그 테마의 CSS 변수로 옮긴다. CMS의 테마 미리보기도 같은 값을 쓴다. */
export function themeCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    '--accent': tokens.accent,
    '--radius-xl': `${tokens.imageRadius}px`,
    '--font-body': BODY_FONTS[tokens.bodyFont].stack,
  };
}

/**
 * 본문 Markdown 안에 들어갈 수 있는 HTML. 글 편집기(#17)는 Markdown에 없는 서식이 든 문단만
 * 한 줄 HTML로 저장한다. 블로그는 이 목록만 통과시키고(rehype-sanitize 등) 나머지는 지운다.
 */
export const BODY_HTML_ALLOWLIST = {
  tags: [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'u',
    'mark',
    'sup',
    'sub',
    'strong',
    'em',
    's',
    'code',
    'a',
    'br',
  ],
  attributes: {
    a: ['href', 'target', 'rel'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
  },
  /** `style` 속성에 허용하는 값. 문단 정렬만 쓴다. */
  style: /^text-align: (?:left|center|right|justify);?$/,
} as const;
