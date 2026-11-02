import { loadBlog } from '../src/blog';
import { renderMarkdown } from '../src/markdown';
import { Shell } from '../src/shell';
import { Prose } from '../theme';

export const metadata = { title: '페이지를 찾을 수 없어요' };

/** 없는 주소. `content/pages/404.md`가 있으면 그 내용을, 없으면 기본 문구를 보인다. */
export default function NotFound() {
  const blog = loadBlog();
  const page = blog.notFound;
  const body = page ? renderMarkdown(page.body, blog.basePath).content : null;
  return (
    <Shell blog={blog} surface="article">
      <main className="mx-auto flex min-h-[70vh] max-w-article-max flex-col justify-center gap-6 px-5 pt-[140px] pb-24">
        <h1 className="m-0 text-post-title text-balance max-md:text-[36px] max-md:leading-11">
          {page?.title ?? '페이지를 찾을 수 없어요'}
        </h1>
        {body ? (
          <Prose>{body}</Prose>
        ) : (
          <p className="m-0 text-lead text-fg-muted">주소가 바뀌었거나 지워진 글이에요.</p>
        )}
        <a
          href={`${blog.basePath}/`}
          className="text-menu text-fg-link underline underline-offset-4"
        >
          홈으로 가요
        </a>
      </main>
    </Shell>
  );
}
