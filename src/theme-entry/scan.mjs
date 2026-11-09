// 테마 폴더의 파일과 코드를 검사한다. 코드는 실행하지 않는다(`check.mjs`가 부른다).
// 코드는 글자를 정규식으로 훑지 않고 Next 빌드와 같은 파서(SWC)로 읽어, 빌드가 따라갈 수 있는 가져오기를 모두 본다.
//   - 파일: `.ts`·`.tsx`(코드), `.css`, `.json`, 이미지·글꼴·글만 둔다. 심볼릭 링크, `node_modules`, `package.json`,
//     CSS Modules(`.module.css`)는 둘 수 없다.
//   - 가져오기 경로: `import`·`export … from`·`import('…')`·`typeof import('…')`의 경로가 react, @lbs/theme-kit, lucide-react
//     (템플릿이 설치한 것)이거나 테마 폴더 안의 `.ts`·`.tsx`·`.json`이어야 한다.
//   - 빌드가 경로를 따로 읽는 문법(`require`·`module`·`exports`, `import.meta`, 글자 하나가 아닌 `import()`, `import x = require()`,
//     `declare module`, 가져오기 속성 `with`)과, 도구가 주석에서 읽는 지시(`@ts-expect-error` 등, `@jsx…`, `/// <…>`)는 막는다.
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, isAbsolute, join, relative, sep } from 'node:path';

/** 테마가 가져올 수 있는 패키지. 그 밖에는 테마 폴더 안의 파일만 가져온다(결정 #106). */
export const ALLOWED_PACKAGES = new Set([
  'react',
  'react/jsx-runtime',
  '@lbs/theme-kit',
  'lucide-react',
]);
export const ALLOWED_TEXT =
  '테마는 react, @lbs/theme-kit, lucide-react와 테마 폴더 안 파일만 가져와요.';

const CODE = new Set(['.ts', '.tsx']);
/** 코드가 가져올 수 있는 테마 파일 */
const IMPORTABLE = new Set(['.ts', '.tsx', '.json']);
const DATA = new Set([
  '.css',
  '.json',
  '.md',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
]);
const PLAIN_NAMES = new Set(['LICENSE', 'README', 'NOTICE', '.DS_Store']);

/** 도구가 주석 글자에서 읽는 지시. 파일 어디에든 그 글자가 있으면 막는다(주석 밖에서 걸려도 막는 쪽이 낫다). */
const DIRECTIVES = [
  [
    /@ts-(?:ignore|expect-error|nocheck)/i,
    '@ts-ignore, @ts-expect-error, @ts-nocheck는 쓸 수 없어요. 타입 오류를 숨기지 말고 고치세요.',
  ],
  [
    /@jsx/i,
    '@jsx로 시작하는 주석 지시(@jsxImportSource 등)는 쓸 수 없어요. JSX는 늘 react로 바꿔요.',
  ],
  [
    /^\s*\/\/\/\s*</m,
    '/// <reference> 같은 지시 주석은 쓸 수 없어요. 다른 파일은 import로 가져오세요.',
  ],
];

const BANNED = {
  commonjs: `require, module, exports는 쓸 수 없어요. 파일은 import로 가져오세요. ${ALLOWED_TEXT}`,
  importMeta:
    'import.meta는 쓸 수 없어요. 파일은 import로 가져오고, 이미지와 글꼴은 CSS의 url()로 쓰세요.',
  dynamic:
    'import()에는 따옴표로 쓴 글자 하나만 넣을 수 있어요. 변수나 식으로 경로를 만들지 말고, 두 번째 인자도 쓰지 마세요.',
  importEquals: "import x = require('…')는 쓸 수 없어요. import x from '…'로 쓰세요.",
  declareModule:
    'declare module은 쓸 수 없어요. 가져오기 목록 밖의 모듈에 타입을 붙여 우회할 수 있어요.',
  attributes: "가져오기 속성(with { … })은 쓸 수 없어요. import x from '…'만 쓰세요.",
};
const COMMONJS = new Set(['require', 'module', 'exports']);

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

/** Next가 쓰는 SWC 파서. 빌드가 테마 코드를 읽는 것과 같은 파서다. */
async function swcParser(app) {
  const swc = createRequire(join(app, 'package.json'))('next/dist/build/swc');
  await swc.loadBindings();
  return swc.parse;
}

/** SWC JSON 트리를 돈다. 속성 이름(`a.b`의 `b`, `{ b: 1 }`의 `b`)인 Identifier에는 `optional`이 없다. */
function visit(node, fn) {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, fn);
  } else if (node && typeof node === 'object') {
    if (typeof node.type === 'string') fn(node);
    for (const key in node) if (key !== 'span') visit(node[key], fn);
  }
}

/** 코드 파일의 가져오기 경로와 쓸 수 없는 문법 */
function readModule(ast) {
  const specs = [];
  const banned = new Set();
  visit(ast, (node) => {
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportNamedDeclaration':
        if (node.source) specs.push(node.source.value);
        if (node.with) banned.add(BANNED.attributes);
        break;
      case 'TsImportType':
        specs.push(node.argument.value);
        break;
      case 'CallExpression': {
        if (node.callee.type !== 'Import') break;
        const [first, ...rest] = node.arguments;
        if (first && !first.spread && first.expression.type === 'StringLiteral' && !rest.length)
          specs.push(first.expression.value);
        else banned.add(BANNED.dynamic);
        break;
      }
      case 'TsImportEqualsDeclaration':
        if (node.moduleRef.type === 'TsExternalModuleReference') banned.add(BANNED.importEquals);
        break;
      case 'TsModuleDeclaration':
        if (node.id.type === 'StringLiteral') banned.add(BANNED.declareModule);
        break;
      case 'MetaProperty':
        if (node.kind === 'import.meta') banned.add(BANNED.importMeta);
        break;
      case 'Identifier':
        if ('optional' in node && COMMONJS.has(node.value)) banned.add(BANNED.commonjs);
        break;
    }
  });
  return { specs, banned };
}

/** 패키지 폴더(실제 경로). 빌드처럼 `from`에서 위로 올라가며 처음 만나는 `node_modules/<이름>`이다. */
function packageDir(from, name) {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(candidate)) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

const packageName = (spec) =>
  spec
    .split('/')
    .slice(0, spec.startsWith('@') ? 2 : 1)
    .join('/');

/** 가져오기 경로 하나가 목록 밖이면 그 이유, 허용이면 null */
function specIssue(spec, { importer, themeDir, app }) {
  if (ALLOWED_PACKAGES.has(spec)) {
    const name = packageName(spec);
    const found = packageDir(dirname(importer), name);
    if (found === packageDir(app, name)) return null;
    return `'${spec}'를 템플릿이 설치한 패키지가 아닌 곳(${found ? posix(relative(app, found)) : '없음'})에서 찾아요. 테마 폴더 위에 있는 node_modules를 지우세요.`;
  }
  if (!spec.startsWith('./') && !spec.startsWith('../'))
    return `'${spec}'는 테마에서 가져올 수 없어요. ${ALLOWED_TEXT}`;
  if (/[%\\?#:\s\p{Cc}]/u.test(spec))
    return `'${spec}'에 쓸 수 없는 글자(%, \\, ?, #, :, 공백)가 있어요. 테마 폴더 안 파일의 경로만 쓰세요.`;
  const target = join(dirname(importer), spec);
  if (!inside(themeDir, target))
    return `'${spec}'는 테마 폴더 밖의 파일이라 가져올 수 없어요. ${ALLOWED_TEXT}`;
  const file = [
    target,
    `${target}.tsx`,
    `${target}.ts`,
    `${target}.json`,
    join(target, 'index.tsx'),
    join(target, 'index.ts'),
  ].find(isFile);
  if (!file) return `'${spec}' 파일이 테마 폴더에 없어요. 경로와 확장자를 확인하세요.`;
  if (!IMPORTABLE.has(extname(file).toLowerCase()))
    return `'${spec}'는 코드에서 가져올 수 없어요. 코드에서는 .ts, .tsx, .json만 가져와요. CSS는 theme.css에서 @import하고, 이미지와 글꼴은 CSS의 url()로 쓰세요.`;
  return null;
}

async function codeIssues(path, { parse, themeDir, app }) {
  const text = readFileSync(path, 'utf8');
  const found = DIRECTIVES.filter(([pattern]) => pattern.test(text)).map(([, message]) => message);
  let ast;
  try {
    // Next처럼 `.ts`는 JSX 없이, `.tsx`는 JSX로 읽는다.
    ast = await parse(text, { filename: `x${extname(path).toLowerCase()}`, isModule: true });
  } catch (error) {
    const detail = String(error?.message ?? error)
      .split('\n')
      .filter((line) => line.trim())
      .slice(0, 6);
    return [...found, ['코드를 읽을 수 없어요. 문법 오류를 고치세요.', ...detail].join('\n')];
  }
  const { specs, banned } = readModule(ast);
  found.push(...banned);
  for (const spec of specs) {
    const message = specIssue(spec, { importer: path, themeDir, app });
    if (message) found.push(message);
  }
  return found;
}

/** 테마 폴더 안의 파일. 둘 수 없는 것(심볼릭 링크, `node_modules`)은 `report`로 알리고 넣지 않는다. */
function list(dir, report) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      report(path, '심볼릭 링크는 테마에 둘 수 없어요. 링크 대신 파일을 넣으세요.');
      return [];
    }
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') return list(path, report);
      report(
        path,
        'node_modules 폴더는 테마에 둘 수 없어요. 테마는 npm 의존성 없이 react, @lbs/theme-kit, lucide-react만 써요.',
      );
      return [];
    }
    if (!entry.isFile()) {
      report(path, '일반 파일이 아니라서 테마에 둘 수 없어요.');
      return [];
    }
    return [{ path, name: entry.name }];
  });
}

/**
 * 테마 폴더(`themeDir`) 안의 모든 파일을 검사한다. 돌려주는 값은 `{ file, message }` 목록(`file`은 `label/상대 경로`)이고 비면 통과다.
 * `app`은 블로그 템플릿 폴더다(Next의 파서와, 허용한 패키지를 설치한 `node_modules`가 있는 곳).
 * @param {{ app: string, themeDir: string, label: string }} options
 * @returns {Promise<{ file: string, message: string }[]>}
 */
export async function scanThemeFiles({ app, themeDir, label }) {
  const issues = [];
  const seen = new Set();
  const report = (path, message) => {
    const file = `${label}/${posix(relative(themeDir, path))}`;
    const key = `${file}\0${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ file, message });
  };
  const parse = await swcParser(app);
  for (const { path, name } of list(themeDir, report)) {
    const ext = extname(name).toLowerCase();
    if (name === 'package.json') {
      report(
        path,
        'package.json은 테마에 둘 수 없어요. 가져오기 경로를 바꾸는 설정(imports, exports, browser)이 들어갈 수 있어요.',
      );
    } else if (name.toLowerCase().endsWith('.module.css')) {
      report(
        path,
        'CSS Modules(.module.css)는 쓸 수 없어요. 스타일은 theme.css와 Tailwind 클래스로 쓰세요.',
      );
    } else if (CODE.has(ext)) {
      for (const message of await codeIssues(path, { parse, themeDir, app })) report(path, message);
    } else if (!DATA.has(ext) && !(ext === '' && PLAIN_NAMES.has(name))) {
      report(
        path,
        `${ext || '확장자 없는'} 파일은 테마에 둘 수 없어요. 코드는 .ts나 .tsx로 쓰고, 그 밖에는 .css, .json, 이미지, 글꼴만 둘 수 있어요.`,
      );
    }
  }
  return issues;
}
