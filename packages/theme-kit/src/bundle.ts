/**
 * 테마 묶음(zip)의 크기와 파일 이름 제한. `theme:pack`(블로그 저장소)과 CMS 올리기 검사가 같은 표와 문구를 쓴다.
 *
 * `manifest.ts`처럼 이 파일도 다른 파일을 값으로 가져오지 않고, Node가 타입만 지우고 바로 실행할 수 있는 문법만 쓴다.
 * 파일 종류(확장자)와 코드의 가져오기는 여기서 보지 않는다. 그쪽은 빌드가 쓰는 검사(`scan.mjs`)가 맡는다.
 */
import type { ThemeIssue } from './manifest';

const KB = 1024;
const MB = 1024 * KB;

/** 한 번 올릴 수 있는 테마 묶음의 상한 */
export const THEME_LIMITS = {
  /** zip 파일 하나 */
  zipBytes: 5 * MB,
  /** 압축을 푼 파일의 합계 */
  unpackedBytes: 10 * MB,
  /** 압축을 푼 크기를 zip 크기로 나눈 값(zip 폭탄 방어) */
  ratio: 100,
  files: 300,
  /** 글자 파일(코드, CSS, JSON, 글) 하나 */
  sourceBytes: 256 * KB,
  /** 이미지, 글꼴 하나 */
  assetBytes: 2 * MB,
} as const;

const TEXT_EXTENSIONS = ['.ts', '.tsx', '.css', '.json', '.md', '.txt'];

/** 폴더에서 압축하는 도구가 끼워 넣는 찌꺼기. 올릴 때 조용히 버린다. */
export function isJunkEntry(path: string): boolean {
  return path
    .split('/')
    .some((part) => part === '__MACOSX' || part === '.DS_Store' || part === 'Thumbs.db');
}

/** 이름을 보고 막는 설정 파일. 지금은 빌드가 무시하지만 그 동작에 기대지 않는다. */
const TOOL_CONFIGS: Record<string, string> = {
  'tsconfig.json':
    'tsconfig.json은 테마에 둘 수 없어요. 타입 검사와 빌드 설정은 템플릿이 정해요. 지우세요.',
  'jsconfig.json':
    'jsconfig.json은 테마에 둘 수 없어요. 타입 검사와 빌드 설정은 템플릿이 정해요. 지우세요.',
};

export interface BundleEntry {
  /** 묶음 맨 위 기준 경로(`screens/post.tsx`). `/`로 나눈다 */
  path: string;
  size: number;
}

const kb = (bytes: number) => `${Math.ceil(bytes / KB)}KB`;
/** 0.1MB 단위로 올려 쓴다. 한계 바로 위의 값도 한계와 다르게 보이도록 올림이다. */
const mb = (bytes: number) => `${Math.ceil((bytes / MB) * 10) / 10}MB`;

function isText(path: string): boolean {
  const lower = path.toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** 경로 하나가 묶음 안의 상대 경로로 쓸 수 있는지. 문제가 있으면 이유. */
function pathProblem(path: string): string | undefined {
  if (path === '' || path.startsWith('/') || /^[a-zA-Z]:/.test(path))
    return '경로는 테마 폴더 안의 상대 경로여야 해요.';
  if (path.includes('\\')) return '경로에 역슬래시(\\)를 쓸 수 없어요. 폴더는 /로 나누세요.';
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 제어 문자를 찾는 검사다
  if (/[\u0000-\u001f\u007f]/.test(path)) return '경로에 제어 문자가 있어요.';
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..'))
    return '경로에 ., .., 빈 칸 폴더를 쓸 수 없어요. 테마 폴더 밖으로 나가는 경로는 올릴 수 없어요.';
  if (parts.some((part) => part.startsWith('.')))
    return '이름이 .으로 시작하는 숨김 파일과 폴더(.github 포함)는 둘 수 없어요. 지우고 다시 묶으세요.';
  return undefined;
}

/**
 * 압축을 푼 파일 목록(`entries`)이 묶음 제한에 맞는지. 문제는 모두 모아 돌려준다. 비면 통과다.
 * `field`는 문제가 난 파일 경로이고, 묶음 전체의 문제는 `field`가 없다. `isJunkEntry`인 파일은 먼저 걸러 낸 목록을 넘긴다.
 */
export function bundleIssues(entries: readonly BundleEntry[]): ThemeIssue[] {
  const issues: ThemeIssue[] = [];
  const names = new Map<string, string>();
  let total = 0;
  for (const { path, size } of entries) {
    total += size;
    const problem = pathProblem(path);
    if (problem !== undefined) {
      issues.push({ field: path, message: problem });
      continue;
    }
    const folded = path.toLowerCase();
    const other = names.get(folded);
    if (other !== undefined) {
      issues.push({
        field: path,
        message: `대소문자만 다른 같은 이름의 파일이 있어요(${other}). 대소문자를 가리지 않는 파일 시스템에서 한 파일로 합쳐져요. 하나를 지우거나 이름을 바꾸세요.`,
      });
    } else {
      names.set(folded, path);
    }
    const name = path.split('/').pop() ?? path;
    const configMessage = TOOL_CONFIGS[name];
    if (configMessage !== undefined) issues.push({ field: path, message: configMessage });
    const limit = isText(path) ? THEME_LIMITS.sourceBytes : THEME_LIMITS.assetBytes;
    if (size > limit) {
      issues.push({
        field: path,
        message: `파일 크기가 상한(${isText(path) ? kb(THEME_LIMITS.sourceBytes) : mb(THEME_LIMITS.assetBytes)})을 넘어요. 지금 크기: ${size > MB ? mb(size) : kb(size)}. ${isText(path) ? '코드와 CSS는 여러 파일로 나누세요.' : '이미지는 줄이거나 지우세요.'}`,
      });
    }
  }
  if (entries.length > THEME_LIMITS.files) {
    issues.push({
      message: `파일이 ${THEME_LIMITS.files}개를 넘어요. 지금은 ${entries.length}개예요. 쓰지 않는 파일을 지우세요.`,
    });
  }
  if (total > THEME_LIMITS.unpackedBytes) {
    issues.push({
      message: `파일 크기의 합이 상한(${mb(THEME_LIMITS.unpackedBytes)})을 넘어요. 지금 합계: ${mb(total)}. 큰 이미지와 글꼴을 줄이세요.`,
    });
  }
  return issues;
}

/** zip 파일 자체의 크기와 압축률 검사. 맞으면 undefined, 아니면 문구. */
export function zipIssue(zipBytes: number, unpackedBytes: number): string | undefined {
  if (zipBytes > THEME_LIMITS.zipBytes)
    return `zip 크기가 상한(${mb(THEME_LIMITS.zipBytes)})을 넘어요. 지금 크기: ${mb(zipBytes)}. 큰 이미지와 글꼴을 줄이세요.`;
  if (zipBytes > 0 && unpackedBytes / zipBytes > THEME_LIMITS.ratio)
    return `압축률이 ${THEME_LIMITS.ratio}배를 넘어요. 같은 내용이 되풀이되는 큰 파일이 있는지 보세요.`;
  return undefined;
}
