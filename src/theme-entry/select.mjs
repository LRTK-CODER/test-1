#!/usr/bin/env node
// 빌드 전에 지금 테마를 고른다(`predev`, `prebuild`).
//   node src/theme-entry/select.mjs
// `content/theme.json`의 `active`로 `.lbs/theme.ts`(테마 코드와 theme.json)와 `.lbs/theme.css`(Tailwind 진입점)를 만든다.
// 저장소 루트는 `LBS_ROOT`(시험), 없으면 실행한 폴더다. 테마는 실행한 폴더(앱)의 `themes/<id>/`에 있다.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEME_ID, isThemeId } from '@lbs/theme-kit/manifest';

const STATE_FILE = 'content/theme.json';

/**
 * `content/theme.json`의 `active`. 파일이 없거나 읽을 수 없으면 기본 테마다. 모양이 틀린 것은 빌드의 `parseSite`가
 * 파일과 고칠 방법까지 알려 주므로 여기서는 기본 테마로 넘어가기만 한다.
 */
export function activeThemeId(root) {
  try {
    const state = JSON.parse(readFileSync(join(root, STATE_FILE), 'utf8'));
    return isThemeId(state?.active) ? state.active : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

const posix = (path) => path.split('\\').join('/');

/** `from` 폴더에서 본 상대 경로. CSS의 `@import`·`@source`는 `./`나 `../`로 시작해야 상대 경로로 읽는다. */
function relativeTo(from, to) {
  const path = posix(relative(from, to));
  return path.startsWith('.') ? path : `./${path}`;
}

/**
 * Tailwind 진입점. 클래스는 템플릿 `src/`와 테마 폴더의 `.ts`·`.tsx`에서만 찾는다(콘텐츠, 의존성, 빌드 전 스크립트(`.mjs`),
 * 테마의 글·데이터 파일의 글자로 클래스를 만들지 않는다).
 * `from`은 이 CSS를 둘 폴더다. CMS 미리보기(`apps/cms/scripts/build-preview.mjs`)도 같은 함수를 쓴다.
 */
export function entryCss({ from, themeDir, app }) {
  return [
    '@import "tailwindcss" source(none);',
    `@source "${relativeTo(from, join(app, 'src'))}/**/*.{ts,tsx}";`,
    `@import "${relativeTo(from, join(themeDir, 'theme.css'))}";`,
    `@source "${relativeTo(from, themeDir)}/**/*.{ts,tsx}";`,
    '',
  ].join('\n');
}

/** 내용이 바뀌었을 때만 쓴다. 다른 빌드·시험이 같은 파일을 읽는 중이어도 반쯤 쓴 파일을 보지 않게 임시 파일을 옮긴다. */
function writeIfChanged(path, text) {
  try {
    if (readFileSync(path, 'utf8') === text) return;
  } catch {}
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}

/**
 * 지금 테마를 골라 `<app>/.lbs/`에 진입 파일을 만든다.
 * @param {{ root?: string, app?: string }} [options]
 * @returns {{ ok: true, id: string, themeDir: string } | { ok: false, issues: { file: string, message: string }[] }}
 */
export function selectTheme({
  root = process.env.LBS_ROOT || process.cwd(),
  app = process.cwd(),
} = {}) {
  const id = activeThemeId(root);
  const themeDir = join(app, 'themes', id);
  if (!existsSync(themeDir)) {
    return {
      ok: false,
      issues: [
        {
          file: STATE_FILE,
          message: `지금 테마 '${id}'의 폴더(themes/${id}/)가 저장소에 없어요. CMS 테마 화면에서 다른 테마를 적용하거나 테마를 다시 올리세요.`,
        },
      ],
    };
  }
  const out = join(app, '.lbs');
  mkdirSync(out, { recursive: true });
  const theme = relativeTo(out, themeDir);
  writeIfChanged(
    join(out, 'theme.ts'),
    `export { default } from '${theme}/index';\nexport { default as manifest } from '${theme}/theme.json';\n`,
  );
  writeIfChanged(join(out, 'theme.css'), entryCss({ from: out, themeDir, app }));
  return { ok: true, id, themeDir };
}

/** 문제를 `파일: 문구`로 한 줄씩 쓰고 1로 끝낸다. */
export function exitWithIssues(issues) {
  for (const { file, message } of issues) console.error(`${file}: ${message}`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = selectTheme();
  if (!result.ok) exitWithIssues(result.issues);
}
