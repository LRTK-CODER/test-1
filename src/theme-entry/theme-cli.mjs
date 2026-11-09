#!/usr/bin/env node
// 테마를 만드는 사람이 쓰는 도구다. 블로그 저장소에서 `npm run theme:check`, `npm run theme:pack`이 이 파일을 부른다.
//   node src/theme-entry/theme-cli.mjs check [id] [--dir <테마 폴더>]
//   node src/theme-entry/theme-cli.mjs pack  [id] [--dir <테마 폴더>] [--out <zip 파일>]
// id를 빼면 지금 테마(`content/theme.json`의 `active`)다. `--dir`은 `themes/` 밖의 테마 폴더(예: examples/themes/paper)를 가리킨다.
// 검사는 빌드 전 검사(`check.mjs`)와 같은 코드다. 거기에 CMS 올리기와 같은 묶음 제한(`@lbs/theme-kit/bundle`)을 더한다.
// 묶기는 검사를 통과한 테마만 한다. 코드는 실행하지 않는다.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleIssues, isJunkEntry, zipIssue } from '@lbs/theme-kit/bundle';
import { isThemeId, parseThemeManifest } from '@lbs/theme-kit/manifest';
import { checkTheme, templateVersionOf } from './check.mjs';
import { activeThemeId } from './select.mjs';
import { createZip, readZip } from './zip.mjs';

const USAGE = [
  '사용법: npm run theme:check [id]',
  '        npm run theme:pack [id] [-- --out <zip 파일>]',
  '  id를 빼면 지금 테마(content/theme.json의 active)예요.',
  '  themes/ 밖의 폴더는 -- --dir <테마 폴더>로 가리켜요.',
].join('\n');

const posix = (path) => path.split(sep).join('/');
const inside = (dir, path) => {
  const rel = relative(dir, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/** 명령줄을 읽는다. 모르는 옵션이나 남는 글자는 `error`로 알린다. pnpm이 넘기는 `--`는 건너뛴다. */
export function parseArgs(argv) {
  const args = { id: undefined, dir: undefined, out: undefined, error: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--dir' || arg === '--out') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        args.error = `${arg} 뒤에 ${arg === '--dir' ? '테마 폴더' : 'zip 파일'} 경로를 쓰세요.`;
        return args;
      }
      args[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith('-')) {
      args.error = `모르는 옵션이에요: ${arg}`;
      return args;
    } else if (args.id === undefined) {
      args.id = arg;
    } else {
      args.error = `테마 id는 하나만 쓸 수 있어요: ${args.id}, ${arg}`;
      return args;
    }
  }
  return args;
}

/** `themes/` 아래 테마 폴더 이름 */
function installedThemes(app) {
  try {
    return readdirSync(join(app, 'themes'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * 검사할 테마 폴더를 정한다.
 * @returns {{ ok: true, themeDir: string, id: string } | { ok: false, message: string }}
 */
export function resolveTheme({ app, root, id, dir }) {
  if (dir !== undefined) {
    const themeDir = resolve(app, dir);
    if (!inside(app, themeDir))
      return {
        ok: false,
        message: `테마 폴더(${dir})는 블로그 폴더 안에 있어야 해요. 허용한 패키지를 이 폴더의 node_modules에서 찾아요.`,
      };
    if (!existsSync(themeDir)) return { ok: false, message: `테마 폴더(${dir})가 없어요.` };
    return { ok: true, themeDir, id: basename(themeDir) };
  }
  const name = id ?? activeThemeId(root);
  if (!isThemeId(name))
    return {
      ok: false,
      message: `테마 id(${name})가 맞지 않아요. 영문 소문자나 숫자로 시작하는 영문 소문자·숫자·하이픈 2~40자로 쓰세요.`,
    };
  const themeDir = join(app, 'themes', name);
  if (!existsSync(themeDir)) {
    const installed = installedThemes(app);
    return {
      ok: false,
      message: `테마 폴더(themes/${name}/)가 없어요.${installed.length ? ` 있는 테마: ${installed.join(', ')}.` : ' themes/ 폴더에 테마 폴더를 만드세요.'}`,
    };
  }
  return { ok: true, themeDir, id: name };
}

/** 테마 폴더의 파일을 경로순으로 모은다. 폴더가 압축할 때 끼워 넣는 찌꺼기(.DS_Store 등)는 뺀다. */
export function listThemeFiles(themeDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk(themeDir);
  return files
    .map((path) => ({ path: posix(relative(themeDir, path)), absolute: path }))
    .filter(({ path }) => !isJunkEntry(path))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * 테마를 빌드 전 검사와 같은 코드로 검사하고, CMS 올리기와 같은 묶음 제한을 본다.
 * 돌려주는 값은 `{ file, message }` 목록(비면 통과)과, 통과했을 때 쓰는 파일 목록·이름·버전이다.
 */
export async function verifyTheme({ app, root = app, themeDir }) {
  const label = `themes/${basename(themeDir)}`;
  const issues = await checkTheme({ app, themeDir, templateVersion: templateVersionOf(root, app) });
  const files = listThemeFiles(themeDir).map((file) => ({
    ...file,
    size: readFileSync(file.absolute).byteLength,
  }));
  for (const { field, message } of bundleIssues(files)) {
    issues.push({ file: field === undefined ? label : `${label}/${field}`, message });
  }
  if (issues.length) return { issues, files };
  const manifest = parseThemeManifest(
    JSON.parse(readFileSync(join(themeDir, 'theme.json'), 'utf8')),
  );
  return { issues, files, manifest: manifest.ok ? manifest.value : undefined };
}

/**
 * 검사를 통과한 테마를 zip으로 묶는다. 테마 폴더 안의 파일이 맨 위에 놓이고(`theme.json`이 zip의 맨 위), 폴더 항목은 없다.
 * @returns {Promise<{ ok: true, zipPath: string, bytes: number, files: number, sha256: string } | { ok: false, issues: { file: string, message: string }[] }>}
 */
export async function packTheme({ app, root = app, themeDir, out }) {
  const { issues, files, manifest } = await verifyTheme({ app, root, themeDir });
  if (issues.length || !manifest) return { ok: false, issues };
  const entries = files.map(({ path, absolute }) => ({ path, data: readFileSync(absolute) }));
  const zip = createZip(entries);
  const unpacked = entries.reduce((sum, entry) => sum + entry.data.byteLength, 0);
  const problem = zipIssue(zip.byteLength, unpacked);
  if (problem)
    return { ok: false, issues: [{ file: `themes/${basename(themeDir)}`, message: problem }] };

  // 묶은 것을 다시 읽어 폴더의 파일과 한 바이트도 다르지 않은지 본다
  const again = readZip(zip);
  const same =
    again.length === entries.length &&
    again.every(
      (entry, i) => entry.path === entries[i]?.path && entry.data.equals(entries[i].data),
    );
  if (!same)
    return {
      ok: false,
      issues: [
        { file: 'zip', message: '묶은 zip을 다시 읽었더니 폴더의 파일과 달라요. 다시 시도하세요.' },
      ],
    };

  const zipPath = out
    ? resolve(out)
    : join(app, '.lbs', 'packs', `${manifest.id}-${manifest.version}.zip`);
  mkdirSync(dirname(zipPath), { recursive: true });
  const temp = `${zipPath}.${process.pid}.tmp`;
  writeFileSync(temp, zip);
  renameSync(temp, zipPath);
  return {
    ok: true,
    zipPath,
    bytes: zip.byteLength,
    files: entries.length,
    sha256: createHash('sha256').update(zip).digest('hex'),
  };
}

const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))}KB`;

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'check' && command !== 'pack') fail([USAGE]);
  const args = parseArgs(rest);
  if (args.error) fail([args.error, USAGE]);
  const app = process.cwd();
  const root = process.env.LBS_ROOT || app;
  const target = resolveTheme({ app, root, id: args.id, dir: args.dir });
  if (!target.ok) fail([target.message]);
  const label = `themes/${target.id}`;

  if (command === 'check') {
    const { issues, files, manifest } = await verifyTheme({ app, root, themeDir: target.themeDir });
    if (issues.length) fail(issues.map(({ file, message }) => `${file}: ${message}`));
    const size = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`${label}: 검사를 통과했어요.`);
    console.log(
      `  ${manifest?.name} ${manifest?.version} · 테마 계약 ${manifest?.contract} · 파일 ${files.length}개 ${kb(size)}`,
    );
    return;
  }

  const result = await packTheme({ app, root, themeDir: target.themeDir, out: args.out });
  if (!result.ok) fail(result.issues.map(({ file, message }) => `${file}: ${message}`));
  console.log(`${label}: 묶었어요.`);
  console.log(`  ${result.zipPath}`);
  console.log(`  파일 ${result.files}개 · zip ${kb(result.bytes)} · sha256 ${result.sha256}`);
  console.log('  CMS 테마 화면에서 이 zip을 올리세요.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
