import { ContentError, type ContentIssue, type Result } from './issues';

/**
 * 이 LBS가 새 블로그 저장소에 넣는 블로그 템플릿(테마 계약)의 버전. `apps/blog-template`의 버전과 같다.
 * 계약이 바뀌면 올린다: 호환되지 않게 바뀌면 major(0.x에서는 minor), 호환되게 더하면 minor, 고침만 있으면 patch.
 */
export const TEMPLATE_VERSION = '0.1.1';

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

/**
 * 블로그 저장소의 템플릿 버전(`lbs.json`의 `templateVersion`)을 이 LBS가 다룰 수 있는지 확인한다.
 * - patch는 보지 않는다.
 * - 1.0 이후: major가 같고 블로그의 minor가 `supported`의 minor 이하면 다룰 수 있다.
 * - 0.x: minor가 다르면 계약이 달라서 다룰 수 없다.
 * 다룰 수 없으면 무엇이 다른지와 어떻게 해야 하는지를 담은 문제를 돌려준다.
 */
export function checkTemplateVersion(
  manifest: { templateVersion?: unknown } | null | undefined,
  supported: string = TEMPLATE_VERSION,
): Result<{ version: string }> {
  const version = manifest?.templateVersion;
  if (version === undefined || version === null)
    return fail(
      'lbs.json에 templateVersion이 없어요. "templateVersion": "0.1.0"처럼 블로그를 만든 템플릿의 버전을 넣어 주세요.',
    );
  if (typeof version !== 'string') return fail(badFormat(version));
  const blog = parse(version);
  const mine = parse(supported);
  if (!blog) return fail(badFormat(version));
  if (!mine) throw new Error(`지원하는 템플릿 버전 '${supported}'가 버전 형식이 아니에요.`);

  const [bMajor, bMinor] = blog;
  const [sMajor, sMinor] = mine;
  const same = bMajor === sMajor && (sMajor === 0 ? bMinor === sMinor : bMinor <= sMinor);
  if (same) return { ok: true, value: { version } };

  const newer = bMajor > sMajor || (bMajor === sMajor && bMinor > sMinor);
  // 숫자 뒤에 오는 조사(은/는, 으로/로)가 숫자 읽기에 따라 달라지지 않게 "버전"이라는 말에 붙인다.
  return fail(
    newer
      ? `이 블로그는 템플릿 ${version} 버전으로 만들어졌어요. 지금 LBS가 다룰 수 있는 버전은 ${supported} 버전까지예요. LBS를 새 버전으로 올려 주세요.`
      : `이 블로그는 템플릿 ${version} 버전으로 만들어졌고, 지금 LBS는 ${supported} 버전을 써요. 블로그 템플릿을 ${supported} 버전으로 올린 뒤 다시 시도해 주세요.`,
  );
}

/** `checkTemplateVersion`이 실패하면 ContentError를 던진다. CMS는 블로그 저장소를 읽은 직후, 다른 일을 하기 전에 부른다. */
export function assertSupportedTemplateVersion(
  manifest: { templateVersion?: unknown } | null | undefined,
  supported?: string,
): void {
  const result = checkTemplateVersion(manifest, supported);
  if (!result.ok) throw new ContentError(result.issues);
}
