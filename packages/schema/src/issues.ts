import type { z } from 'zod';
import { slugify } from './slug';

/** 파일 하나의 문제 하나. `message`는 무엇이 틀렸고 어떻게 고치는지 함께 쓴다. */
export interface ContentIssue {
  file: string;
  field?: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: ContentIssue[] };

export function formatIssues(issues: readonly ContentIssue[]): string {
  return issues.map((issue) => `${issue.file}: ${issue.message}`).join('\n');
}

export class ContentError extends Error {
  readonly issues: ContentIssue[];

  constructor(issues: ContentIssue[]) {
    super(`콘텐츠 파일에 문제가 ${issues.length}개 있어요.\n${formatIssues(issues)}`);
    this.name = 'ContentError';
    this.issues = issues;
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ContentError(result.issues);
  return result.value;
}

/** 스키마의 `refine`이 `params.rule`로 이 표의 이름을 넘기면 그 문구를 쓴다. */
const RULE_MESSAGES = {
  slug: (field: string, input: unknown) => {
    const suggestion = typeof input === 'string' ? slugify(input) : undefined;
    return `${field} 값이 주소 규칙에 맞지 않아요(${show(input)}). 영문 소문자, 숫자, 하이픈(-)만 써 주세요.${suggestion ? ` 예: ${suggestion}` : ''}`;
  },
  dateTime: (field: string, input: unknown) =>
    `${field} 값이 날짜·시간 형식이 아니에요(${show(input)}). 2026-11-03T09:00:00+09:00처럼 시간대까지 써 주세요.`,
  mediaPath: (field: string, input: unknown) =>
    `${field} 값이 미디어 경로 규칙에 맞지 않아요(${show(input)}). /media/2026/10/cover.png처럼 /media/연/월/파일 이름으로 써 주세요. 파일 이름은 영문 소문자, 숫자, -, _, .만 쓰고 확장자는 png, jpg, jpeg, webp, gif 중 하나예요.`,
  hexColor: (field: string, input: unknown) =>
    `${field} 값이 색 형식이 아니에요(${show(input)}). #ff6f0f처럼 #과 16진수 6자리로 써 주세요.`,
  timeZone: (field: string, input: unknown) =>
    `${field} 값이 알 수 없는 시간대예요(${show(input)}). Asia/Seoul처럼 IANA 시간대 이름을 써 주세요.`,
  language: (field: string, input: unknown) =>
    `${field} 값이 언어 코드가 아니에요(${show(input)}). ko나 en-US처럼 써 주세요.`,
  semver: (field: string, input: unknown) =>
    `${field} 값이 버전 형식이 아니에요(${show(input)}). 0.1.0처럼 숫자 세 개를 점으로 이어 써 주세요.`,
} satisfies Record<string, (field: string, input: unknown) => string>;

export type Rule = keyof typeof RULE_MESSAGES;

const TYPE_NAMES: Record<string, string> = {
  string: '글자',
  number: '숫자',
  int: '정수',
  boolean: 'true 또는 false',
  array: '목록',
  object: '`이름: 값` 묶음',
  record: '`이름: 값` 묶음',
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function show(input: unknown): string {
  return typeof input === 'string' ? `'${input}'` : JSON.stringify(input);
}

function fieldName(path: readonly PropertyKey[]): string {
  return path
    .map((key, i) => {
      if (typeof key === 'number') return `[${key}]`;
      const name = String(key);
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) return `[${JSON.stringify(name)}]`;
      return i === 0 ? name : `.${name}`;
    })
    .join('');
}

const fallback = (field: string) =>
  `${field} 값의 형식이 틀렸어요. 문서의 예시와 비교해 고쳐 주세요.`;

function koreanMessage(issue: z.core.$ZodIssue, field: string): string {
  const input = issue.input;
  switch (issue.code) {
    case 'invalid_type':
      return input === undefined
        ? `${field} 값이 없어요. ${field} 항목을 넣어 주세요.`
        : `${field} 값은 ${TYPE_NAMES[issue.expected] ?? issue.expected} 형식이어야 해요(지금 값: ${show(input)}).`;
    case 'too_big':
      if (issue.origin === 'string')
        return `${field} 값이 너무 길어요. ${issue.maximum}자 이하로 줄여 주세요.`;
      if (issue.origin === 'array')
        return `${field} 항목이 너무 많아요. ${issue.maximum}개 이하로 줄여 주세요.`;
      return `${field} 값이 너무 커요(지금 값: ${show(input)}). ${issue.maximum} 이하로 써 주세요.`;
    case 'too_small':
      if (issue.origin === 'string') return `${field} 값이 비어 있어요. 내용을 넣어 주세요.`;
      if (issue.origin === 'array')
        return `${field} 항목이 모자라요. ${issue.minimum}개 이상 넣어 주세요.`;
      return `${field} 값이 너무 작아요(지금 값: ${show(input)}). ${issue.minimum} 이상으로 써 주세요.`;
    case 'invalid_value':
      return `${field} 값을 쓸 수 없어요(${show(input)}). ${issue.values.join(', ')} 중 하나로 고쳐 주세요.`;
    case 'invalid_union': {
      // 판별 항목(status, type) 값이 틀리면 Zod는 묶음 전체를 input으로 넘긴다.
      const { options } = issue as { options?: unknown[] };
      if (!options) return fallback(field);
      const value = isRecord(input) ? input[String(issue.path.at(-1))] : input;
      if (value === undefined)
        return `${field} 값이 없어요. ${options.join(', ')} 중 하나를 넣어 주세요.`;
      return `${field} 값을 쓸 수 없어요(${show(value)}). ${options.join(', ')} 중 하나로 고쳐 주세요.`;
    }
    case 'invalid_format':
      if (issue.format === 'datetime') return RULE_MESSAGES.dateTime(field, input);
      if (issue.format === 'url')
        return `${field} 값이 주소 형식이 아니에요(${show(input)}). https://로 시작하는 전체 주소를 써 주세요.`;
      return `${field} 값의 형식이 틀렸어요(${show(input)}).`;
    case 'invalid_key': {
      // 목록의 키(미디어 경로 등)가 틀린 경우. 키 자체를 검사한 결과로 설명한다.
      const [inner] = issue.issues;
      return inner
        ? koreanMessage({ ...inner, input: String(issue.path.at(-1)) } as z.core.$ZodIssue, field)
        : fallback(field);
    }
    case 'unrecognized_keys': {
      const keys = issue.keys.map((key) => `'${key}'`).join(', ');
      const where = field === '파일 내용' ? '' : `${field}에서 `;
      return `${where}${keys} 항목은 쓸 수 없어요. 철자를 확인하거나 지워 주세요.`;
    }
    case 'custom': {
      const rule = issue.params?.rule as Rule | undefined;
      if (rule && rule in RULE_MESSAGES) return RULE_MESSAGES[rule](field, input);
      return `${field}: ${issue.message}`;
    }
    default:
      return fallback(field);
  }
}

/** Zod 검사 결과를 파일 이름과 항목 이름이 붙은 한국어 문제 목록으로 바꾼다. */
export function issuesFromZod(file: string, error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => {
    const field = fieldName(issue.path);
    return field
      ? { file, field, message: koreanMessage(issue, field) }
      : { file, message: koreanMessage(issue, '파일 내용') };
  });
}

export function parseWith<S extends z.ZodType>(
  file: string,
  schema: S,
  data: unknown,
): Result<z.output<S>> {
  const parsed = schema.safeParse(data, { reportInput: true });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, issues: issuesFromZod(file, parsed.error) };
}
