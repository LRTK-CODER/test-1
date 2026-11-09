import { loadTheme } from '../src/active-theme';
import { loadBlog } from '../src/blog';
import { ThemeScreen } from '../src/screen';
import { shareMetadata, siteDescription } from '../src/share';
import { homeProps } from '../src/theme-props';

export function generateMetadata() {
  const blog = loadBlog();
  return shareMetadata(blog, {
    title: blog.site.info.name,
    description: siteDescription(blog),
    route: { type: 'home' },
  });
}

export default function Page() {
  const { theme, context } = loadTheme();
  return <ThemeScreen theme={theme} screen={{ type: 'home', props: homeProps(context) }} />;
}
