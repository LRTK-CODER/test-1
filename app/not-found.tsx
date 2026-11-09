import { loadTheme } from '../src/active-theme';
import { ThemeScreen } from '../src/screen';
import { notFoundProps } from '../src/theme-props';

export const metadata = { title: '페이지를 찾을 수 없어요' };

/** 없는 주소. `content/pages/404.md`가 있으면 테마가 그 내용을 보인다. */
export default function NotFound() {
  const { theme, context } = loadTheme();
  return (
    <ThemeScreen theme={theme} screen={{ type: 'not-found', props: notFoundProps(context) }} />
  );
}
