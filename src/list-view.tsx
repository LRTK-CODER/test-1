import type { Post } from '@lbs/schema';
import { CategoryTabs, FeaturedPost, Intro, PostGrid } from '../theme';
import type { Blog } from './blog';
import { Shell } from './shell';
import { type CurrentRoute, categoryTabs, postSummary } from './views';

export interface ListViewProps {
  blog: Blog;
  current: CurrentRoute;
  title: string;
  lead?: string;
  /** 크게 보여 줄 글(홈에서만) */
  featured?: Post;
  posts: Post[];
}

/** 홈과 카테고리 화면이 함께 쓰는 목록 화면. 넘겨받은 글은 모두 공개된 글이어야 한다. */
export function ListView({ blog, current, title, lead, featured, posts }: ListViewProps) {
  return (
    <Shell blog={blog} current={current}>
      <main className="mx-auto flex max-w-page-max flex-col gap-18 px-5 pt-[172px] pb-24 max-md:pt-32">
        <Intro title={title} lead={lead} />
        {featured ? <FeaturedPost {...postSummary(blog, featured, true)} /> : null}
        <section aria-label="글 목록" className="flex flex-col gap-10">
          <CategoryTabs label="카테고리" items={categoryTabs(blog, current)} />
          {posts.length ? (
            <PostGrid posts={posts.map((post) => postSummary(blog, post))} />
          ) : (
            <p className="m-0 py-16 text-center text-fg-muted">아직 발행한 글이 없어요.</p>
          )}
        </section>
      </main>
    </Shell>
  );
}
