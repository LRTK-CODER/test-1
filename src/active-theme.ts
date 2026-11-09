import { ContentError, type ContentIssue } from '@lbs/schema';
import type { Theme } from '@lbs/theme-kit';
import { parseThemeManifest, resolveSettings } from '@lbs/theme-kit/manifest';
import theme, { manifest as rawManifest } from '../.lbs/theme';
import { loadBlog } from './blog';
import { type ThemeContext, themeSettings } from './theme-props';

/**
 * 빌드가 쓰는 테마. `.lbs/theme.ts`는 빌드 전에 `src/theme-entry/select.mjs`가 `content/theme.json`의 `active`로 만든다.
 * 설정 값(`content/theme.json`의 `settings.<id>`)이 테마의 정의에 맞지 않으면 콘텐츠 오류로 빌드를 멈춘다.
 */
export interface ActiveTheme {
  theme: Theme;
  context: ThemeContext;
  /** `:root`에 쓰는 CSS 변수. `theme.json`의 설정 순서다 */
  cssVariables: Record<string, string>;
}

const STATE_FILE = 'content/theme.json';

let cached: ActiveTheme | undefined;

export function loadTheme(): ActiveTheme {
  if (cached) return cached;
  const blog = loadBlog();
  const parsed = parseThemeManifest(rawManifest);
  if (!parsed.ok) {
    const lines = parsed.issues.map(({ field, message }) =>
      field ? `${field}: ${message}` : message,
    );
    throw new Error(`빌드에 들어간 테마의 theme.json이 맞지 않아요.\n${lines.join('\n')}`);
  }
  const manifest = parsed.value;
  const { active, settings } = blog.site.themeState;
  if (manifest.id !== active) {
    throw new Error(
      `${STATE_FILE}의 지금 테마는 '${active}'인데 빌드에 들어간 테마는 '${manifest.id}'예요. 빌드(개발 중이면 개발 서버)를 다시 시작하세요.`,
    );
  }
  const resolved = resolveSettings(manifest.settings, settings[manifest.id]);
  if (resolved.issues.length) {
    throw new ContentError(
      resolved.issues.map((issue): ContentIssue => {
        const field = issue.field
          ? `settings.${manifest.id}.${issue.field}`
          : `settings.${manifest.id}`;
        return {
          file: STATE_FILE,
          field,
          message: `${field} 값이 테마 설정에 맞지 않아요. ${issue.message}. 값을 고치거나, 지워서 기본값을 쓰세요.`,
        };
      }),
    );
  }
  cached = {
    theme,
    cssVariables: resolved.cssVariables,
    context: {
      blog,
      settings: themeSettings(blog, manifest.settings, resolved.values),
      preview: false,
    },
  };
  return cached;
}
