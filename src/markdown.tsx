import { BODY_HTML_ALLOWLIST } from '@lbs/schema';
import type { Element, Root } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { CodeBlock, type TocItem } from '../theme';

/**
 * 글 본문(Markdown)을 React 요소로 바꾼다. 결정 #17: CommonMark + GFM이고, Markdown에 없는 서식이 든
 * 문단만 한 줄 HTML이다. 순서는 다음과 같다.
 * 1. Markdown을 읽고(GFM 표·체크박스·취소선·각주), HTML 조각은 그대로 둔 채 HTML 트리로 바꾼다.
 * 2. HTML 조각을 트리로 풀고, `BODY_HTML_ALLOWLIST`에 없는 태그와 속성(script, on* 속성, javascript: 주소)을 지운다.
 * 3. 허용한 `style`도 문단 정렬 값만 남긴다.
 * 4. 제목에 id를 달고(h2·h3), 사이트 안 링크와 이미지 주소에 basePath를 붙인다.
 */

const CLOBBER_PREFIX = 'user-content-';

function sanitizeSchema(): SanitizeSchema {
  const { tags, attributes } = BODY_HTML_ALLOWLIST;
  const base = defaultSchema.attributes ?? {};
  const merged: Record<string, NonNullable<SanitizeSchema['attributes']>[string]> = { ...base };
  for (const [tag, names] of Object.entries(attributes)) {
    merged[tag] = [...(base[tag] ?? []), ...names];
  }
  return {
    ...defaultSchema,
    // 본문 HTML의 id·name에는 기본 접두사(user-content-)가 붙는다. 본문이 document.cookie 같은
    // 전역 이름을 덮지 못하게 하려는 것이다. 제목 id와 목차 링크도 같은 접두사를 쓴다.
    clobberPrefix: CLOBBER_PREFIX,
    // style 요소는 태그만 지우면 안의 CSS가 글자로 남아서 내용까지 지운다.
    strip: [...new Set([...(defaultSchema.strip ?? []), 'style'])],
    tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...tags])],
    attributes: merged,
  };
}

const schema = sanitizeSchema();

function textOf(node: Element): string {
  return node.children
    .map((child) =>
      child.type === 'element' ? textOf(child) : child.type === 'text' ? child.value : '',
    )
    .join('');
}

/** 제목 글자로 id를 만든다. 한글은 그대로 두고, 같은 글자가 또 나오면 -2, -3을 붙인다. */
export function headingId(text: string, used: Map<string, number>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function isInternal(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

function visit(node: Root | Element, fn: (el: Element) => void) {
  for (const child of node.children) {
    if (child.type === 'element') {
      fn(child);
      visit(child, fn);
    }
  }
}

function finish(basePath: string, toc: TocItem[], imageSrc?: (path: string) => string) {
  return () => (tree: Root) => {
    const used = new Map<string, number>();
    visit(tree, (el) => {
      const props = el.properties;
      const style = props.style;
      if (typeof style === 'string' && !BODY_HTML_ALLOWLIST.style.test(style.trim()))
        delete props.style;
      if (el.tagName === 'h2' || el.tagName === 'h3') {
        // 각주 머리말처럼 화면에 보이지 않는 제목(sr-only)은 목차에 넣지 않는다.
        const hidden = Array.isArray(props.className) && props.className.includes('sr-only');
        if (!hidden) {
          const label = textOf(el).trim();
          const id = `${CLOBBER_PREFIX}${headingId(label, used)}`;
          props.id = id;
          if (el.tagName === 'h2') toc.push({ id, label, depth: 2 });
        }
      } else if (el.tagName === 'a') {
        // 같은 글 안의 앵커(각주, 직접 쓴 #링크)도 id와 같은 접두사로 맞춘다.
        if (typeof props.href === 'string' && props.href.startsWith('#') && props.href !== '#')
          props.href = `#${CLOBBER_PREFIX}${props.href.slice(1)}`;
        if (isInternal(props.href)) props.href = `${basePath}${props.href}`;
        if (props.target === '_blank') props.rel = ['noopener', 'noreferrer'];
        else delete props.target;
      } else if (el.tagName === 'img') {
        if (isInternal(props.src))
          props.src = imageSrc ? imageSrc(props.src) : `${basePath}${props.src}`;
        props.loading = 'lazy';
      }
    });
  };
}

/** 코드 블록은 테마의 CodeBlock으로 그린다. 각주 머리말은 sr-only 클래스로 숨긴다(이 글자가 있어야 Tailwind가 클래스를 만든다). */
function Pre({ children }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];
  if (!isValidElement(child)) return <pre>{children}</pre>;
  const code = child as ReactElement<{ className?: string; children?: ReactNode }>;
  const language = /language-(\S+)/.exec(code.props.className ?? '')?.[1];
  const text = Children.toArray(code.props.children).join('').replace(/\n$/, '');
  return <CodeBlock code={text} language={language ?? 'text'} />;
}

export interface RenderedMarkdown {
  content: ReactNode;
  /** h2 기준 목차 */
  toc: TocItem[];
}

/**
 * `basePath`는 `/저장소` 또는 `''`. 본문의 `/media/...` 이미지와 `/posts/...` 같은 사이트 안 링크에 붙인다.
 * `<a href>`와 `<img src>`는 Next.js가 basePath를 붙여 주지 않기 때문이다.
 */
export function renderMarkdown(
  source: string,
  basePath: string,
  /** 본문 이미지 주소를 직접 정한다(CMS 미리보기). 주면 basePath를 이미지에 붙이지 않는다. */
  options: { imageSrc?: (path: string) => string } = {},
): RenderedMarkdown {
  const toc: TocItem[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      clobberPrefix: '',
      footnoteLabel: '각주',
      footnoteBackLabel: '본문으로 돌아가기',
    })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(finish(basePath, toc, options.imageSrc));
  const tree = processor.runSync(processor.parse(source)) as Root;
  const content = toJsxRuntime(tree, { Fragment, jsx, jsxs, components: { pre: Pre } });
  return { content, toc };
}
