#!/usr/bin/env node
// 빌드 전에 지금 테마가 테마 계약에 맞는지 검사한다(`predev`, `prebuild`).
//   node src/theme-entry/check.mjs
// 문제가 있으면 `파일: 문구`를 한 줄씩 쓰고 1로 끝난다. Next 빌드보다 먼저 돌아 테마 문제를 테마 파일 이름으로 알려 준다.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractIssue, parseThemeManifest } from '@lbs/theme-kit/manifest';
import { scanThemeFiles } from './scan.mjs';
import { exitWithIssues, selectTheme } from './select.mjs';
import { checkThemeCss } from './theme-css.mjs';

const posix = (path) => path.split(sep).join('/');

/** `theme.json`, `index.tsx`, `theme.css`. 문제가 있으면 담고, 이 단계를 통과하면 true. */
function checkStructure({ themeDir, label, templateVersion }, issues) {
  const manifestFile = `${label}/theme.json`;
  let data;
  try {
    data = JSON.parse(readFileSync(join(themeDir, 'theme.json'), 'utf8'));
  } catch (error) {
    issues.push({
      file: manifestFile,
      message:
        error.code === 'ENOENT'
          ? '파일이 없어요. 테마 이름, 버전, 계약 버전을 담은 theme.json을 테마 폴더에 넣으세요.'
          : `JSON으로 읽을 수 없어요. 쉼표와 따옴표를 확인하세요. (${error.message})`,
    });
    return false;
  }
  const parsed = parseThemeManifest(data);
  if (!parsed.ok) {
    for (const { field, message } of parsed.issues)
      issues.push({ file: manifestFile, message: field ? `${field}: ${message}` : message });
    return false;
  }
  const manifest = parsed.value;
  const folder = basename(themeDir);
  if (manifest.id !== folder) {
    issues.push({
      file: manifestFile,
      message: `id: 테마 id(${manifest.id})와 폴더 이름(${folder})이 달라요. 둘을 같게 맞추세요.`,
    });
  }
  const contract = contractIssue(manifest.contract, templateVersion);
  if (contract) issues.push({ file: manifestFile, message: `contract: ${contract}` });
  for (const [name, what] of [
    ['index.tsx', '화면을 export default defineTheme({ ... })로 내보내는 파일이에요.'],
    ['theme.css', '테마 스타일의 진입점이에요.'],
  ]) {
    if (!existsSync(join(themeDir, name)))
      issues.push({
        file: `${label}/${name}`,
        message: `파일이 없어요. 테마 폴더에 ${name} 파일을 넣으세요. ${what}`,
      });
  }
  return issues.length === 0;
}

/** 타입 오류 줄과 그 아래 설명 줄(들여 쓴 줄) */
function errorLines(output) {
  const lines = [];
  let inError = false;
  for (const line of output.split('\n')) {
    if (/\(\d+,\d+\): error TS\d+:|^error TS\d+:/.test(line)) {
      inError = true;
      lines.push(line);
    } else if (inError && /^ {2}\S/.test(line)) {
      lines.push(line);
    } else {
      inError = false;
    }
  }
  return lines;
}

/** 테마 폴더 전체를 한 번 타입 검사해 계약(`Theme`, 필수 화면 포함)을 확인한다. 가져오기는 `scan.mjs`가 이미 본다. */
function checkTypes({ app, themeDir, label, workDir }, issues) {
  const tsc = join(
    dirname(createRequire(join(app, 'package.json')).resolve('typescript/package.json')),
    'bin/tsc',
  );
  const entry = join(workDir, 'theme-check.ts');
  const fromWork = (path) => {
    const rel = posix(relative(workDir, path));
    return rel.startsWith('.') ? rel : `./${rel}`;
  };
  writeFileSync(
    entry,
    `import type { Theme } from '@lbs/theme-kit';\nimport theme from '${fromWork(join(themeDir, 'index'))}';\nexport const checked: Theme = theme;\n`,
  );
  writeFileSync(
    join(workDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        extends: fromWork(join(app, 'tsconfig.json')),
        compilerOptions: { incremental: false, noEmit: true },
        include: [
          `${fromWork(themeDir)}/**/*.ts`,
          `${fromWork(themeDir)}/**/*.tsx`,
          './theme-check.ts',
        ],
        exclude: [],
      },
      null,
      2,
    )}\n`,
  );
  const result = spawnSync(
    process.execPath,
    [tsc, '-p', join(workDir, 'tsconfig.json'), '--pretty', 'false', '--locale', 'en'],
    { cwd: app, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status === 0) return;
  const errors = errorLines(`${result.stdout}\n${result.stderr}`);
  issues.push({
    file: label,
    message: ['테마 계약에 맞지 않아요. 아래 타입 오류를 고치세요.', ...errors].join('\n'),
  });
}

/**
 * 테마 폴더(`themeDir`)가 이 템플릿에서 빌드될 수 있는지 검사한다. 돌려주는 값은 `{ file, message }` 목록이고 비면 통과다.
 * - `app`: 블로그 템플릿 폴더(`tsconfig.json`, `node_modules`가 있는 곳). 테마 폴더도 이 안에 있어야 패키지를 찾는다.
 * - `templateVersion`: 블로그의 `lbs.json` 값. 계약이 맞지 않을 때 문구에 쓴다.
 * - `workDir`: 타입 검사용 파일을 둘 빈 폴더. 없으면 `app/.lbs/` 아래에 만들고 지운다.
 * 파일과 가져오기(`scan.mjs`)나 CSS(`theme-css.mjs`)에서 문제가 나오면 타입 검사는 하지 않는다(`node:fs`를 가져오면
 * `@types/node`를 설치하라는 엉뚱한 안내가 나오는 것을 막는다).
 * @param {{ app: string, themeDir: string, templateVersion: string, workDir?: string }} options
 * @returns {Promise<{ file: string, message: string }[]>}
 */
export async function checkTheme({ app, themeDir, templateVersion, workDir }) {
  const label = `themes/${basename(themeDir)}`;
  const issues = [];
  if (!checkStructure({ themeDir, label, templateVersion }, issues)) return issues;
  issues.push(...(await scanThemeFiles({ app, themeDir, label })));
  issues.push(...(await checkThemeCss({ app, themeDir, label })));
  if (issues.length) return issues;
  const temporary = workDir === undefined;
  let dir = workDir;
  if (temporary) {
    mkdirSync(join(app, '.lbs'), { recursive: true });
    dir = mkdtempSync(join(app, '.lbs', 'check-'));
  } else {
    mkdirSync(dir, { recursive: true });
  }
  try {
    checkTypes({ app, themeDir, label, workDir: dir }, issues);
  } finally {
    if (temporary) rmSync(dir, { recursive: true, force: true });
  }
  return issues;
}

/** 블로그의 `lbs.json`에 적힌 템플릿 버전. 읽을 수 없으면 '알 수 없는'. */
export function templateVersionOf(root, app) {
  for (const dir of [root, app]) {
    try {
      const { templateVersion } = JSON.parse(readFileSync(join(dir, 'lbs.json'), 'utf8'));
      if (typeof templateVersion === 'string') return templateVersion;
    } catch {}
  }
  return '알 수 없는';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = process.cwd();
  const root = process.env.LBS_ROOT || app;
  const selected = selectTheme({ root, app });
  if (!selected.ok) exitWithIssues(selected.issues);
  const issues = await checkTheme({
    app,
    themeDir: selected.themeDir,
    templateVersion: templateVersionOf(root, app),
  });
  if (issues.length) exitWithIssues(issues);
}
