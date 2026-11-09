import { CoverImage } from './cover-image';
import { ThemeLink } from './link';
import type { PostSummary } from './types';

export interface FeaturedPostProps extends PostSummary {
  eyebrow?: string;
}

/** 홈에서 가장 최근 글 하나를 크게 보여 준다. 좁은 화면에서는 이미지 아래로 글이 쌓인다. */
export function FeaturedPost({
  href,
  eyebrow = '새 글',
  category,
  title,
  excerpt,
  date,
  readingTime,
  image,
}: FeaturedPostProps) {
  return (
    <ThemeLink
      href={href ?? '#'}
      className="flex flex-wrap items-center gap-8 text-fg-default no-underline"
    >
      <div className="min-w-0 flex-[1_1_520px]">
        <CoverImage src={image} ratio="16x10" decorative={!image} />
      </div>
      <div className="flex flex-[1_1_340px] flex-col gap-3">
        <span className="text-meta text-fg-subtle">
          {eyebrow} · {category}
        </span>
        <span className="text-featured-title text-balance max-md:text-[32px] max-md:leading-10">
          {title}
        </span>
        {excerpt ? <span className="text-fg-muted">{excerpt}</span> : null}
        <span className="text-meta text-fg-subtle">
          {date}
          {readingTime ? ` · ${readingTime}` : ''}
        </span>
      </div>
    </ThemeLink>
  );
}
