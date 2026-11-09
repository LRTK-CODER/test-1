import { loadBlog } from '../../src/blog';
import { generatedFile, sitemapXml } from '../../src/feed';

export const dynamic = 'force-static';

export function GET() {
  return generatedFile('sitemap.xml', sitemapXml(loadBlog()), 'application/xml; charset=utf-8');
}
