import { routePath, type Slug } from '@lbs/schema';
import type { Blog } from './blog';

type Kind = 'post' | 'category' | 'page';

function fileOf(type: Kind, slug: string): string {
  return `${routePath({ type, slug: slug as Slug }).slice(1)}index.html`;
}

/** 이동 기록이 있는 옛 주소 목록. `visibleRedirects`에서 온 기록만 쓰므로 공개되지 않은 대상으로 가는 기록은 없다(#45). */
export function redirectSlugs(blog: Blog, type: Kind): string[] {
  return blog.site.visibleRedirects.filter((r) => r.type === type).map((r) => r.from as string);
}

/**
 * `generateStaticParams`가 빈 목록을 돌려주면 정적 내보내기가 실패한다(새 블로그는 글이 없다).
 * 비면 슬러그 규칙에 맞지 않아 실제 주소와 겹칠 수 없는 `-`를 하나 돌려주고, 페이지는 이 주소를 404로 처리한다.
 */
export function atLeastOne(params: { slug: string }[]): { slug: string }[] {
  return params.length ? params : [{ slug: '-' }];
}

/** 옛 주소가 이동할 곳(basePath 포함). 기록이 없으면 undefined. */
export function redirectTarget(blog: Blog, type: Kind, slug: string): string | undefined {
  const file = fileOf(type, slug);
  return blog.stubs.find((stub) => stub.file === file)?.to;
}

/**
 * 옛 주소의 이동 페이지. 정적 호스팅에는 서버 이동이 없어서 `<meta http-equiv="refresh">`로 보내고,
 * 검색 엔진에는 `rel=canonical`로 새 주소를 알린다(#36). `to`는 basePath가 붙은 주소다.
 */
export function RedirectPage({ to }: { to: string }) {
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${to}`} />
      <meta name="robots" content="noindex" />
      <link rel="canonical" href={to} />
      <main className="mx-auto flex min-h-screen max-w-article-max flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="m-0 text-lead text-fg-default">주소가 바뀌었어요.</p>
        <a href={to} className="text-menu text-fg-link underline underline-offset-4">
          새 주소로 이동해요
        </a>
      </main>
    </>
  );
}
