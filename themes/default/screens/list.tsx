import type { ListProps } from '@lbs/theme-kit';
import { CategoryTabs, FeaturedPost, Intro, type NavLink, PostGrid } from '../parts';
import { summaryOf } from './summary';

/** 카테고리 탭: 전체와, 공개된 글이 있는 카테고리 */
function categoryTabs({ route, categories }: ListProps): NavLink[] {
  return [
    { label: '전체', href: '/', current: route.type === 'home' || undefined },
    ...categories.map((category) => ({
      label: category.name,
      href: category.href,
      current: category.current || undefined,
    })),
  ];
}

/** 홈과 카테고리 화면이 함께 쓰는 목록 화면: 소개, 추천 글 하나(홈), 카테고리 탭, 글 목록 */
export function Home(props: ListProps) {
  const { title, lead, featured, posts } = props;
  return (
    <main className="mx-auto flex max-w-page-max flex-col gap-18 px-5 pt-[172px] pb-24 max-md:pt-32">
      <Intro title={title} lead={lead} />
      {featured ? <FeaturedPost {...summaryOf(featured, true)} /> : null}
      <section aria-label="글 목록" className="flex flex-col gap-10">
        <CategoryTabs label="카테고리" items={categoryTabs(props)} />
        {posts.length ? (
          <PostGrid posts={posts.map((post) => summaryOf(post))} />
        ) : (
          <p className="m-0 py-16 text-center text-fg-muted">아직 발행한 글이 없어요.</p>
        )}
      </section>
    </main>
  );
}
