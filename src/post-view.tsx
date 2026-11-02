import { type Post, routePath } from '@lbs/schema';
import { CoverImage, PostHeader, Prose, RelatedPosts, SideList, Toc } from '../theme';
import { type Blog, categoryOf, publishedAt, relatedPosts } from './blog';
import { renderMarkdown } from './markdown';
import { Shell } from './shell';
import { coverAlt, formatDate, mediaSrc, postHref, readingTime } from './views';

/** 글 화면. 빌드(`app/posts/[slug]/page.tsx`)와 CMS 미리보기가 같은 마크업을 쓴다. */
export function PostView({ blog, post }: { blog: Blog; post: Post }) {
  const slug = post.slug;
  const category = categoryOf(blog, post);
  const { content, toc } = renderMarkdown(post.body, blog.basePath, { imageSrc: blog.imageSrc });
  const related = relatedPosts(blog, post);

  // 왼쪽 목록: 같은 카테고리의 글, 그다음 다른 카테고리 이동
  const sameCategory = blog.posts.filter((p) => p.category === post.category);
  const otherCategories = blog.site.categories.items.filter(
    (c) => c.slug !== post.category && blog.posts.some((p) => p.category === c.slug),
  );
  const sideGroups = [
    {
      label: category.name,
      items: sameCategory.map((p) => ({
        label: p.title,
        href: postHref(p),
        current: p.slug === post.slug || undefined,
      })),
    },
    ...(otherCategories.length
      ? [
          {
            label: '다른 카테고리',
            items: otherCategories.map((c) => ({
              label: c.name,
              href: routePath({ type: 'category', slug: c.slug }),
            })),
          },
        ]
      : []),
  ];

  return (
    <Shell blog={blog} current={{ type: 'post', slug }} surface="article">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pt-[140px] pb-24 max-md:pt-24 min-[1100px]:grid min-[1100px]:grid-cols-[var(--container-sidebar)_minmax(0,var(--container-article-max))_var(--container-toc)] min-[1100px]:items-start min-[1100px]:justify-center min-[1100px]:gap-12">
        <div className="order-3 min-[1100px]:order-1">
          <SideList label={`${category.name} 글`} groups={sideGroups} />
        </div>
        <article className="order-2 flex min-w-0 flex-col gap-10">
          <PostHeader
            category={category.name}
            categoryHref={routePath({ type: 'category', slug: category.slug })}
            title={post.title}
            summary={post.summary}
            date={formatDate(blog, publishedAt(post), true)}
            readingTime={readingTime(blog, post.body)}
          />
          {post.cover ? (
            <CoverImage
              ratio="2x1"
              src={mediaSrc(blog, post.cover)}
              alt={coverAlt(blog, post.cover)}
            />
          ) : null}
          <Prose>{content}</Prose>
          {related.length ? (
            <section
              aria-label="관련 글"
              className="flex flex-col gap-4 border-t border-stroke-subtle pt-10"
            >
              <span className="text-label text-fg-subtle">이어서 읽기</span>
              <RelatedPosts
                posts={related.map((p) => ({
                  title: p.title,
                  description: p.summary,
                  href: postHref(p),
                }))}
              />
            </section>
          ) : null}
        </article>
        <div className="order-1 min-[1100px]:sticky min-[1100px]:top-[100px] min-[1100px]:order-3">
          <Toc items={toc} />
        </div>
      </div>
    </Shell>
  );
}
