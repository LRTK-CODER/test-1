import type { PostSummary as PostData } from '@lbs/theme-kit';
import type { PostSummary } from '../parts';

/** 글 카드와 추천 글이 받는 값. 요약은 추천 글에만 넣는다. */
export function summaryOf(post: PostData, withExcerpt = false): PostSummary {
  return {
    href: post.href,
    title: post.title,
    category: post.category.name,
    date: post.date,
    readingTime: post.readingTime,
    excerpt: withExcerpt ? post.summary : undefined,
    image: post.cover?.src,
  };
}
