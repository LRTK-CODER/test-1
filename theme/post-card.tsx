import { CoverImage } from './cover-image';
import { ThemeLink } from './link';
import type { PostSummary } from './types';

/** 요약은 카드에 넣지 않는다. 요약은 FeaturedPost에만. */
export function PostCard({ href, title, category, date, readingTime, image }: PostSummary) {
  return (
    <ThemeLink
      href={href ?? '#'}
      className="group flex min-w-0 flex-col gap-2.5 text-fg-default no-underline"
    >
      <CoverImage src={image} alt="" ratio="4x3" />
      <span className="text-small text-fg-subtle">{category}</span>
      <span className="text-card-title underline-offset-4 group-hover:underline">{title}</span>
      <span className="text-meta text-fg-subtle">
        {date}
        {readingTime ? ` · ${readingTime}` : ''}
      </span>
    </ThemeLink>
  );
}

export interface PostGridProps {
  posts: PostSummary[];
}

export function PostGrid({ posts }: PostGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-10 max-sm:grid-cols-1">
      {posts.map((post) => (
        <PostCard key={post.href ?? post.title} {...post} />
      ))}
    </div>
  );
}
