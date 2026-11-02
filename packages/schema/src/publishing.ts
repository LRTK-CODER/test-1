import type { Post } from './schemas';

/** CMS 목록의 상태 표시. `scheduled`는 파일에 쓰지 않고 `published` + 미래의 `publishAt`에서 나온다. */
export type PostVisibility = 'draft' | 'review' | 'scheduled' | 'published';

export function postVisibility(post: Post, now: Date): PostVisibility {
  if (post.status !== 'published') return post.status;
  return Date.parse(post.publishAt) <= now.getTime() ? 'published' : 'scheduled';
}

export function isPublished(post: Post, now: Date): boolean {
  return postVisibility(post, now) === 'published';
}

/** 블로그에 보일 글을 최신순으로 돌려준다. 블로그 빌드는 빌드 시각을 `now`로 넘긴다. */
export function publishedPosts(posts: readonly Post[], now: Date): Post[] {
  return posts
    .filter((post) => isPublished(post, now))
    .sort((a, b) => Date.parse(b.publishAt ?? '') - Date.parse(a.publishAt ?? ''));
}
