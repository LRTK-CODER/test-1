import { loadBlog } from '../../src/blog';
import { robotsTxt } from '../../src/feed';

export const dynamic = 'force-static';

export function GET() {
  return new Response(robotsTxt(loadBlog()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
