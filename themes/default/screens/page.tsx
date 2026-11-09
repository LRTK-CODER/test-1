import { Content, type PageProps } from '@lbs/theme-kit';
import { CodeBlock, Prose, Toc } from '../parts';

/** 고정 페이지 화면 */
export function Page({ page }: PageProps) {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pt-[140px] pb-24 max-md:pt-24 min-[1100px]:grid min-[1100px]:grid-cols-[var(--container-sidebar)_minmax(0,var(--container-article-max))_var(--container-toc)] min-[1100px]:justify-center min-[1100px]:gap-12">
      <article className="flex min-w-0 flex-col gap-10 min-[1100px]:col-start-2">
        <header className="flex flex-col gap-3">
          <h1 className="m-0 text-post-title text-balance max-md:text-[36px] max-md:leading-11">
            {page.title}
          </h1>
          {page.summary ? <p className="m-0 text-menu text-fg-muted">{page.summary}</p> : null}
        </header>
        <Prose>
          <Content body={page.body} components={{ codeBlock: CodeBlock }} />
        </Prose>
      </article>
      <div className="min-[1100px]:sticky min-[1100px]:top-[100px] min-[1100px]:col-start-3 min-[1100px]:self-start">
        <Toc items={page.body.toc} />
      </div>
    </div>
  );
}
