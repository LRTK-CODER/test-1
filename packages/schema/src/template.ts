import { ContentError, type ContentIssue, type Result } from './issues';

/**
 * 이 LBS가 새 블로그 저장소에 넣는 블로그 템플릿의 버전. `apps/blog-template`의 버전과 같다.
 * 템플릿 버전과 테마 계약 버전은 따로 움직인다. 테마 계약은 `@lbs/theme-kit`의 `THEME_CONTRACT`다.
 * 템플릿이 호환되지 않게 바뀌면 major(0.x에서는 minor), 호환되게 더하면 minor, 고침만 있으면 patch를 올린다.
 */
export const TEMPLATE_VERSION = '0.2.1';

/**
 * CMS가 읽고 고칠 수 있는 블로그 템플릿 버전. 목록에 있는 줄마다(0.x는 minor가 같으면, patch는 보지 않는다) 다룬다.
 * 0.1은 0.1에서 0.2로 옮기는 작업 전까지 읽을 수 있게 둔다.
 */
export const READABLE_TEMPLATE_VERSIONS = ['0.1.6', TEMPLATE_VERSION] as const;

const MANIFEST_PATH = 'lbs.json';

function fail(message: string): Result<{ version: string }> {
  const issue: ContentIssue = { file: MANIFEST_PATH, field: 'templateVersion', message };
  return { ok: false, issues: [issue] };
}

function badFormat(value: unknown): string {
  return `templateVersion 값이 버전 형식이 아니에요(${JSON.stringify(value)}). 0.1.0처럼 숫자 세 개를 점으로 이어 써 주세요.`;
}

function parse(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function compare(a: readonly number[], b: readonly number[]): number {
  for (const [i, part] of a.entries()) {
    const other = b[i] ?? 0;
    if (part !== other) return part - other;
  }
  return 0;
}

/** 블로그의 템플릿 버전이 `minimum` 이상인지. 어떤 기능을 쓰는 템플릿인지 알아야 할 때 쓴다. 형식이 틀리면 false다. */
export function templateAtLeast(version: string, minimum: string): boolean {
  const a = parse(version);
  const b = parse(minimum);
  if (!a || !b) return false;
  for (const [i, part] of a.entries()) {
    const min = b[i] ?? 0;
    if (part !== min) return part > min;
  }
  return true;
}

/**
 * 블로그 저장소의 템플릿 버전(`lbs.json`의 `templateVersion`)을 이 LBS가 다룰 수 있는지 확인한다.
 * - patch는 보지 않는다.
 * - 1.0 이후: major가 같고 블로그의 minor가 `supported`의 minor 이하면 다룰 수 있다.
 * - 0.x: minor가 다르면 계약이 달라서 다룰 수 없다.
 * `supported`에 여러 버전을 주면 하나라도 다루면 된다.
 * 다룰 수 없으면 무엇이 다른지와 어떻게 해야 하는지를 담은 문제를 돌려준다.
 */
export function checkTemplateVersion(
  manifest: { templateVersion?: unknown } | null | undefined,
  supported: string | readonly string[] = READABLE_TEMPLATE_VERSIONS,
): Result<{ version: string }> {
  const version = manifest?.templateVersion;
  if (version === undefined || version === null)
    return fail(
      'lbs.json에 templateVersion이 없어요. "templateVersion": "0.1.0"처럼 블로그를 만든 템플릿의 버전을 넣어 주세요.',
    );
  if (typeof version !== 'string') return fail(badFormat(version));
  const blog = parse(version);
  if (!blog) return fail(badFormat(version));

  const lines = (typeof supported === 'string' ? [supported] : supported).map((line) => {
    const parsed = parse(line);
    if (!parsed) throw new Error(`지원하는 템플릿 버전 '${line}'가 버전 형식이 아니에요.`);
    return { text: line, parsed };
  });

  const [bMajor, bMinor] = blog;
  const handled = lines.some(
    ({ parsed: [sMajor, sMinor] }) =>
      bMajor === sMajor && (sMajor === 0 ? bMinor === sMinor : bMinor <= sMinor),
  );
  if (handled) return { ok: true, value: { version } };

  const newestFirst = lines.toSorted((a, b) => compare(b.parsed, a.parsed));
  const [newest] = newestFirst;
  const newer = newest !== undefined && compare(blog, newest.parsed) > 0;
  // 숫자 뒤에 오는 조사(은/는, 으로/로)가 숫자 읽기에 따라 달라지지 않게 "버전"이라는 말에 붙인다.
  if (newer)
    return fail(
      `이 블로그는 템플릿 ${version} 버전으로 만들어졌어요. 지금 LBS가 다룰 수 있는 버전은 ${newest.text} 버전까지예요. LBS를 새 버전으로 올려 주세요.`,
    );
  const target = typeof supported === 'string' ? supported : TEMPLATE_VERSION;
  return fail(
    `이 블로그는 템플릿 ${version} 버전으로 만들어졌고, 지금 LBS는 ${target} 버전을 써요. 블로그 템플릿을 ${target} 버전으로 올린 뒤 다시 시도해 주세요.`,
  );
}

/** `checkTemplateVersion`이 실패하면 ContentError를 던진다. CMS는 블로그 저장소를 읽은 직후, 다른 일을 하기 전에 부른다. */
export function assertSupportedTemplateVersion(
  manifest: { templateVersion?: unknown } | null | undefined,
  supported?: string | readonly string[],
): void {
  const result = checkTemplateVersion(manifest, supported);
  if (!result.ok) throw new ContentError(result.issues);
}
