import type {
  BodyData,
  CommonProps,
  ListProps,
  NotFoundProps,
  PageProps,
  PostProps,
  Theme,
} from '@lbs/theme-kit';
import type { ReactElement } from 'react';

/** 한 주소에서 그릴 화면과 그 값 */
export type ScreenData =
  | { type: 'home' | 'category'; props: ListProps }
  | { type: 'post'; props: PostProps }
  | { type: 'page'; props: PageProps }
  | { type: 'not-found'; props: NotFoundProps };

/** 테마에 NotFound가 없을 때 Page로 그리는 기본 제목과 문구(계약 1.0) */
const NOT_FOUND_TITLE = '페이지를 찾을 수 없어요';
const NOT_FOUND_BODY: BodyData = {
  tree: {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: '주소가 바뀌었거나 지워진 글이에요.' }],
      },
    ],
  },
  toc: [],
};

function notFoundAsPage(props: NotFoundProps): PageProps {
  const page = props.page ?? {
    slug: '404',
    href: '/404/',
    title: NOT_FOUND_TITLE,
    body: NOT_FOUND_BODY,
    extra: {},
  };
  return { ...props, route: { type: 'page', slug: page.slug }, page };
}

function body(theme: Theme, screen: ScreenData): ReactElement | null {
  switch (screen.type) {
    case 'home':
      return <theme.Home {...screen.props} />;
    case 'category':
      return theme.Category ? (
        <theme.Category {...screen.props} />
      ) : (
        <theme.Home {...screen.props} />
      );
    case 'post':
      return <theme.Post {...screen.props} />;
    case 'page':
      return <theme.Page {...screen.props} />;
    case 'not-found':
      return theme.NotFound ? (
        <theme.NotFound {...screen.props} />
      ) : (
        <theme.Page {...notFoundAsPage(screen.props)} />
      );
  }
}

/** 한 화면을 테마의 Layout으로 감싸 그린다. Layout은 모든 화면이 받는 값과 바탕(`surface`)만 받는다. */
export function ThemeScreen({ theme, screen }: { theme: Theme; screen: ScreenData }) {
  const { site, nav, categories, settings, route, preview }: CommonProps = screen.props;
  const surface = screen.type === 'home' || screen.type === 'category' ? 'list' : 'article';
  return (
    <theme.Layout
      site={site}
      nav={nav}
      categories={categories}
      settings={settings}
      route={route}
      preview={preview}
      surface={surface}
    >
      {body(theme, screen)}
    </theme.Layout>
  );
}
