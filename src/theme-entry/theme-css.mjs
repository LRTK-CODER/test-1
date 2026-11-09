// 테마 CSS를 블로그 빌드와 같은 방법으로 만들어 보고, 만든 CSS가 가리키는 파일을 검사한다(`check.mjs`가 부른다).
// 빌드의 `@tailwindcss/postcss`가 쓰는 Tailwind 컴파일러(`@tailwindcss/node`)와 클래스 찾기(`@tailwindcss/oxide`)를 그대로 쓰되,
// 불러오기는 아래 규칙으로만 허용하고 JS(`@plugin`, `@config`)는 하나도 불러오지 않는다. 테마 코드와 CSS는 실행하지 않는다.
//   - `@import`: 템플릿 진입점은 `tailwindcss`와 지금 테마의 `theme.css`만, 테마 CSS는 테마 폴더 안의 `.css` 파일만.
//   - `@source`, `source(...)`: 템플릿 진입점만 쓴다(테마는 클래스를 찾을 곳을 바꿀 수 없다).
//   - 만든 CSS의 `url()`(Next 빌드가 파일을 복사하는 것): 테마 폴더 안의 파일, `data:`, `#조각`만. 남은 `@import`는 없어야 한다.
// 만든 CSS는 빌드처럼 `globals.css`(템플릿 폴더) 기준이다. Tailwind가 테마 CSS의 상대 주소를 그 기준으로 바꿔 쓰고,
// 대괄호 클래스(arbitrary value)로 만든 주소는 그대로 그 기준이 된다.
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { entryCss } from './select.mjs';

const ASSET_TEXT = '테마 폴더 안의 파일(./font.woff2), data: 주소, #조각만 가리킬 수 있어요.';

const posix = (path) => path.split(sep).join('/');
const inside = (dir, path) => {
  const rel = relative(dir, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};
const isFile = (path) => {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
};

/** 불러오기를 거절할 때 던진다. 컴파일러가 감싸지 않고 그대로 넘겨 준다. */
class Refused extends Error {
  constructor(file, message) {
    super(message);
    this.file = file;
  }
}

/** 만든 CSS의 주소 하나가 가리키는 곳. 문제가 있으면 이유를 돌려준다. */
function urlIssue(url, { root, themeDir }) {
  if (/^data:/i.test(url) || url.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^[/\\]/.test(url)) return '바깥 주소예요.';
  if (/[%\\\s\p{Cc}]/u.test(url)) return '주소에 쓸 수 없는 글자(%, \\, 공백)가 있어요.';
  const path = resolve(root, url.split(/[?#]/)[0] ?? '');
  if (!inside(themeDir, path)) return `테마 폴더 밖(${posix(relative(root, path))})을 가리켜요.`;
  if (!isFile(path))
    return `가리키는 파일(${posix(relative(themeDir, path))})이 테마 폴더에 없어요.`;
  return null;
}

/** `text`가 든 첫 테마 파일(`dir` 아래, `deep`이면 하위 폴더까지). 문제를 낸 파일을 가리키는 데만 쓴다. */
function fileWith(text, dir, deep) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && deep) {
      const found = fileWith(text, path, deep);
      if (found) return found;
    } else if (entry.isFile() && /\.(css|tsx?)$/i.test(entry.name)) {
      if (readFileSync(path, 'utf8').includes(text)) return path;
    }
  }
  return undefined;
}

/**
 * 지금 테마(`themeDir`)의 CSS를 빌드처럼 만들어 검사한다. 돌려주는 값은 `{ file, message }` 목록이고 비면 통과다.
 * @param {{ app: string, themeDir: string, label: string }} options
 * @returns {Promise<{ file: string, message: string }[]>}
 */
export async function checkThemeCss({ app, themeDir, label }) {
  const require = createRequire(join(app, 'package.json'));
  const { compile } = require('@tailwindcss/node');
  const { Scanner } = require('@tailwindcss/oxide');
  const { transform } = require('lightningcss');
  const root = app;
  const tailwindDir = dirname(require.resolve('tailwindcss/package.json'));
  const themeCss = join(themeDir, 'theme.css');
  const shown = (path) =>
    path && inside(themeDir, path)
      ? `${label}/${posix(relative(themeDir, path))}`
      : `${label}/theme.css`;
  const inTheme = (dir) => dir === themeDir || inside(themeDir, dir);

  /** `@import`, `@reference`가 부르는 CSS 파일. `base`는 부르는 CSS 파일의 폴더다. */
  async function stylesheet(id, base) {
    if (base === root && id === 'tailwindcss') return join(tailwindDir, 'index.css');
    if (base === root && resolve(base, id) === themeCss) return themeCss;
    if (inside(tailwindDir, base) && id.startsWith('./') && inside(tailwindDir, resolve(base, id)))
      return resolve(base, id);
    const path = resolve(base, id);
    const local =
      inTheme(base) &&
      /^\.\.?\//.test(id) &&
      !/[?#%\\]/.test(id) &&
      extname(path).toLowerCase() === '.css' &&
      !path.toLowerCase().endsWith('.module.css') &&
      inside(themeDir, path) &&
      isFile(path);
    if (local) return path;
    throw new Refused(
      inTheme(base) ? fileWith(id, base, false) : undefined,
      `@import "${id}"는 쓸 수 없어요. 테마 CSS는 테마 폴더 안의 .css 파일만 "./파일.css"처럼 가져와요(tailwindcss는 템플릿이 불러와요).`,
    );
  }

  let compiler;
  try {
    compiler = await compile(entryCss({ from: root, themeDir, app }), {
      base: root,
      from: join(root, 'globals.css'),
      shouldRewriteUrls: true,
      onDependency() {},
      customCssResolver: stylesheet,
      async customJsResolver(id, base) {
        throw new Refused(
          inTheme(base) ? fileWith(id, base, false) : undefined,
          `@plugin과 @config는 쓸 수 없어요('${id}'). 테마 CSS는 Tailwind 기본 기능과 @theme, @utility만 써요.`,
        );
      },
    });
  } catch (error) {
    if (error instanceof Refused) return [{ file: shown(error.file), message: error.message }];
    return [
      {
        file: `${label}/theme.css`,
        message: `Tailwind가 테마 CSS를 만들지 못했어요. ${String(error?.message ?? error)}`,
      },
    ];
  }

  const issues = [];
  // 템플릿 진입점이 정한 것만 남아야 한다. 테마 CSS의 @source(not 포함)는 base가 테마 폴더다.
  const sources = compiler.sources.filter((source) => source.base === root);
  if (sources.length !== compiler.sources.length || compiler.root !== 'none') {
    issues.push({
      file: `${label}/theme.css`,
      message:
        '@source와 source(...)는 테마 CSS에서 쓸 수 없어요. 템플릿이 테마 폴더의 .ts·.tsx에서 클래스를 찾아요.',
    });
  }

  // 빌드는 이 결과를 lightningcss로 줄여 쓴 뒤(오류가 난 규칙은 버린다) Next가 다시 읽는다. 줄이기 전 결과를 오류 없이 읽혀야
  // 통과로 보므로, 줄인 결과의 주소는 여기서 본 주소 안에 있다.
  const css = compiler.build(new Scanner({ sources }).scan());
  let dependencies;
  try {
    ({ dependencies } = transform({
      filename: join(root, 'globals.css'),
      code: Buffer.from(css),
      analyzeDependencies: true,
    }));
  } catch (error) {
    issues.push({
      file: `${label}/theme.css`,
      message: `만든 CSS를 읽을 수 없어요. 테마 CSS의 문법을 확인하세요. ${String(error?.message ?? error)}`,
    });
    return issues;
  }
  for (const { type, url } of dependencies ?? []) {
    const bad =
      type === 'import'
        ? `바깥 CSS를 가져오는 @import "${url}"가 만든 CSS에 남아요. 테마 CSS는 테마 폴더 안의 .css 파일만 "./파일.css"처럼 가져와요.`
        : urlIssue(url, { root, themeDir });
    if (!bad) continue;
    const file = fileWith(url, themeDir, true);
    const fromClass =
      file && /\.tsx?$/i.test(file) && !/^[a-z][a-z0-9+.-]*:/i.test(url)
        ? ' 대괄호 클래스의 상대 주소는 테마 폴더가 아니라 템플릿 폴더(globals.css) 기준이에요. 테마의 이미지는 theme.css에 클래스를 만들어 url(./파일)로 쓰세요.'
        : '';
    issues.push({
      file: shown(file),
      message:
        type === 'import'
          ? bad
          : `url(${url.slice(0, 80)})는 쓸 수 없어요. ${bad} 테마 CSS의 url()과 Tailwind 대괄호 클래스의 url은 ${ASSET_TEXT}${fromClass}`,
    });
  }
  return issues;
}
