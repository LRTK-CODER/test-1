import { Content, type PostProps } from '@lbs/theme-kit';
import { CodeBlock, CoverImage, PostHeader, Prose, RelatedPosts, SideList, Toc } from '../parts';

/** 글 화면: 왼쪽 목록, 본문, 목차 */
export function Post({ post, sameCategory, categories, related }: PostProps) {
  const { category } = post;
  const others = categories.filter((c) => c.slug !== category.slug);
  // 왼쪽 목록: 같은 카테고리의 글, 그다음 다른 카테고리 이동
  const sideGroups = [
    {
      label: category.name,
      items: sameCategory.map((p) => ({
        label: p.title,
        href: p.href,
        current: p.slug === post.slug || undefined,
      })),
    },
    ...(others.length
      ? [
          {
            label: '다른 카테고리',
            items: others.map((c) => ({ label: c.name, href: c.href })),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pt-[140px] pb-24 max-md:pt-24 min-[1100px]:grid min-[1100px]:grid-cols-[var(--container-sidebar)_minmax(0,var(--container-article-max))_var(--container-toc)] min-[1100px]:items-start min-[1100px]:justify-center min-[1100px]:gap-12">
      <div className="order-3 min-[1100px]:order-1">
        <SideList label={`${category.name} 글`} groups={sideGroups} />
      </div>
      <article className="order-2 flex min-w-0 flex-col gap-10">
        <PostHeader
          category={category.name}
          categoryHref={category.href}
          title={post.title}
          summary={post.summary}
          date={post.dateLong}
          readingTime={post.readingTime}
        />
        {post.cover ? <CoverImage ratio="2x1" src={post.cover.src} alt={post.cover.alt} /> : null}
        <Prose>
          <Content body={post.body} components={{ codeBlock: CodeBlock }} />
        </Prose>
        {related.length ? (
          <section
            aria-label="관련 글"
            className="flex flex-col gap-4 border-t border-stroke-subtle pt-10"
          >
            <span className="text-label text-fg-subtle">이어서 읽기</span>
            <RelatedPosts
              posts={related.map((p) => ({ title: p.title, description: p.summary, href: p.href }))}
            />
          </section>
        ) : null}
      </article>
      <div className="order-1 min-[1100px]:sticky min-[1100px]:top-[100px] min-[1100px]:order-3">
        <Toc items={post.body.toc} />
      </div>
    </div>
  );
}
