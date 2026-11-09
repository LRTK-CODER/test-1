import { loadBlog } from '../../src/blog';
import { FEED_TYPE, feedXml, generatedFile } from '../../src/feed';

export const dynamic = 'force-static';

export function GET() {
  return generatedFile('feed.xml', feedXml(loadBlog()), `${FEED_TYPE}; charset=utf-8`);
}
