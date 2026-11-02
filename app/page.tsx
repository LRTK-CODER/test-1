import { featuredPost, loadBlog } from '../src/blog';
import { ListView } from '../src/list-view';

/** 홈: 소개, 추천 글 하나, 카테고리 탭, 나머지 글 목록 */
export default function Page() {
  const blog = loadBlog();
  const { info } = blog.site;
  const featured = featuredPost(blog);
  return (
    <ListView
      blog={blog}
      current={{ type: 'home' }}
      title={info.tagline ?? info.name}
      lead={info.description}
      featured={featured}
      posts={blog.posts.filter((post) => post !== featured)}
    />
  );
}
