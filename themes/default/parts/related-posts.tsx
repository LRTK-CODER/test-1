import { ThemeLink } from './link';

export interface RelatedPostsProps {
  posts: { title: string; description?: string; href?: string }[];
}

/** 같은 시리즈나 같은 태그의 글 2~4개를 회색 카드로 보여 준다. */
export function RelatedPosts({ posts }: RelatedPostsProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 max-sm:grid-cols-1">
      {posts.map((post) => (
        <ThemeLink
          key={post.title}
          href={post.href ?? '#'}
          className="flex flex-col gap-1 rounded-lg bg-bg-subtle p-5 text-fg-default no-underline hover:bg-bg-subtle-hover"
        >
          <span className="text-menu font-semibold">{post.title}</span>
          {post.description ? (
            <span className="text-meta text-fg-muted">{post.description}</span>
          ) : null}
        </ThemeLink>
      ))}
    </div>
  );
}
