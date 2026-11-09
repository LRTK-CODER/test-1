import { Content, Link, type NotFoundProps } from '@lbs/theme-kit';
import { CodeBlock, Prose } from '../parts';

/** 없는 주소. `content/pages/404.md`가 있으면 그 내용을, 없으면 기본 문구를 보인다. */
export function NotFound({ page }: NotFoundProps) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-article-max flex-col justify-center gap-6 px-5 pt-[140px] pb-24">
      <h1 className="m-0 text-post-title text-balance max-md:text-[36px] max-md:leading-11">
        {page?.title ?? '페이지를 찾을 수 없어요'}
      </h1>
      {page ? (
        <Prose>
          <Content body={page.body} components={{ codeBlock: CodeBlock }} />
        </Prose>
      ) : (
        <p className="m-0 text-lead text-fg-muted">주소가 바뀌었거나 지워진 글이에요.</p>
      )}
      <Link href="/" className="text-menu text-fg-link underline underline-offset-4">
        홈으로 가요
      </Link>
    </main>
  );
}
