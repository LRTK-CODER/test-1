import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import {
  Children,
  type ComponentType,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import type { BodyData } from './contract';

export interface CodeBlockProps {
  code: string;
  /** `language-ts` 클래스에서 읽은 언어. 없으면 `text` */
  language: string;
}

export interface ContentComponents {
  /** 본문의 코드 블록(`<pre><code>`)을 그린다. 없으면 `<pre><code>` 그대로 */
  codeBlock?: ComponentType<CodeBlockProps>;
}

export interface ContentProps {
  body: BodyData;
  components?: ContentComponents;
}

/** 본문 트리(`BodyData.tree`)를 React 요소로 그린다. 감싸는 요소는 없다(테마가 감싼다). */
export function Content({ body, components }: ContentProps): ReactElement {
  const CodeBlock = components?.codeBlock;
  return toJsxRuntime(body.tree, {
    Fragment,
    jsx,
    jsxs,
    components: CodeBlock ? { pre: preFor(CodeBlock) } : {},
  });
}

// 렌더마다 새 컴포넌트를 만들면 React가 코드 블록을 매번 다시 만든다. CodeBlock마다 하나만 만든다.
const preCache = new WeakMap<
  ComponentType<CodeBlockProps>,
  ComponentType<{ children?: ReactNode }>
>();

function preFor(CodeBlock: ComponentType<CodeBlockProps>) {
  let Pre = preCache.get(CodeBlock);
  if (!Pre) {
    Pre = function Pre({ children }: { children?: ReactNode }) {
      const child = Children.toArray(children)[0];
      if (!isValidElement(child)) return <pre>{children}</pre>;
      const code = child as ReactElement<{ className?: string; children?: ReactNode }>;
      const language = /language-(\S+)/.exec(code.props.className ?? '')?.[1];
      const text = Children.toArray(code.props.children).join('').replace(/\n$/, '');
      return <CodeBlock code={text} language={language ?? 'text'} />;
    };
    preCache.set(CodeBlock, Pre);
  }
  return Pre;
}
