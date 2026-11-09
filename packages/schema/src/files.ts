import YAML from 'yaml';
import type { z } from 'zod';
import { ContentError, type ContentIssue, isRecord, parseWith, type Result } from './issues';
import {
  CategoriesSchema,
  type Extra,
  ManifestSchema,
  MediaLibrarySchema,
  MIN_SCHEMA_VERSION,
  NavigationSchema,
  PAGE_KEYS,
  type Page,
  PageFrontMatterSchema,
  POST_KEYS,
  type Post,
  PostFrontMatterSchema,
  RESERVED_PAGE_SLUGS,
  RedirectsSchema,
  SCHEMA_VERSION,
  SiteInfoSchema,
  ThemeStateSchema,
  ThemeTokensSchema,
} from './schemas';
import { isSlug, type Slug, slugify } from './slug';

/** JSON 파일 하나. `parse`는 파일 내용을, `validate`는 CMS 화면에서 만든 값을 같은 규칙으로 검사한다. */
export interface JsonFile<T> {
  readonly path: string;
  parse(text: string): Result<T>;
  validate(data: unknown): Result<T>;
  serialize(value: T): string;
}

/** 파일 이름이 주소인 Markdown 파일 묶음. 파일 이름과 다른 주소를 front matter에 따로 두지 않는다. */
export interface MarkdownCollection<T extends { slug: Slug }> {
  readonly dir: string;
  pathFor(slug: Slug): string;
  parse(path: string, text: string): Result<T>;
  validate(slug: string, frontMatter: Record<string, unknown>, body: string): Result<T>;
  serialize(doc: T): string;
}

const fail = (issues: ContentIssue[]): { ok: false; issues: ContentIssue[] } => ({
  ok: false,
  issues,
});

/** `known` 순서로 먼저 쓰고, 그 뒤에 테마가 더 넣은 항목을 원래 순서대로 붙인다. */
function ordered(
  known: readonly string[],
  value: object,
  extra: Extra = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const source = value as Record<string, unknown>;
  for (const key of known) if (source[key] !== undefined) out[key] = source[key];
  for (const [key, item] of Object.entries(extra)) if (!known.includes(key)) out[key] = item;
  return out;
}

function extraOf(raw: unknown, known: readonly string[]): Extra {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !known.includes(key)));
}

/** 윈도 메모장 등이 맨 앞에 붙이는 UTF-8 BOM을 지운다. */
const stripBom = (text: string) => text.replace(/^\uFEFF/, '');

function readJson(path: string, text: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(stripBom(text)) };
  } catch (error) {
    return fail([
      {
        file: path,
        message: `JSON 문법이 틀렸어요(${(error as Error).message}). 쉼표와 따옴표, 괄호 짝이 맞는지 확인해 주세요.`,
      },
    ]);
  }
}

function makeJsonFile<T>(
  path: string,
  schema: z.ZodObject,
  keepExtra: boolean,
  check: (value: T) => ContentIssue[],
): JsonFile<T> {
  const keys = Object.keys(schema.shape);
  const validate = (data: unknown): Result<T> => {
    const parsed = parseWith(path, schema, data);
    if (!parsed.ok) return parsed;
    const value = (keepExtra ? { ...parsed.value, extra: extraOf(data, keys) } : parsed.value) as T;
    const issues = check(value);
    return issues.length ? fail(issues) : { ok: true, value };
  };
  return {
    path,
    validate,
    parse(text) {
      const raw = readJson(path, text);
      return raw.ok ? validate(raw.value) : raw;
    },
    serialize(value) {
      const { extra, ...known } = value as { extra?: Extra };
      return `${JSON.stringify(ordered(keys, known, extra), null, 2)}\n`;
    },
  };
}

function jsonFile<S extends z.ZodObject>(
  path: string,
  schema: S,
  check: (value: z.output<S>) => ContentIssue[] = () => [],
): JsonFile<z.output<S>> {
  return makeJsonFile(path, schema, false, check);
}

/** 최상위에 테마가 더 넣은 항목을 `extra`로 지켜 주는 JSON 파일. */
function extensibleJsonFile<S extends z.ZodObject>(
  path: string,
  schema: S,
): JsonFile<z.output<S> & { extra: Extra }> {
  return makeJsonFile(path, schema, true, () => []);
}

/* ---------- Markdown + front matter ---------- */

const FRONT_MATTER = /^---\n((?:.*\n)*?)---(?:\n|$)/;

function normalizeBody(body: string): string {
  const trimmed = body.replace(/^\n+/, '').trimEnd();
  return trimmed ? `${trimmed}\n` : '';
}

function splitFrontMatter(
  path: string,
  text: string,
): Result<{ data: Record<string, unknown>; body: string }> {
  const source = stripBom(text).replace(/\r\n?/g, '\n');
  const match = FRONT_MATTER.exec(source);
  if (!match)
    return fail([
      {
        file: path,
        message:
          'front matter가 없어요. 파일 맨 앞에 --- 줄로 감싼 front matter를 넣어 주세요(예: ---⏎title: 제목⏎---).',
      },
    ]);
  const doc = YAML.parseDocument(match[1] ?? '');
  const [error] = doc.errors;
  if (error) {
    const line = (error.linePos?.[0]?.line ?? 0) + 1;
    return fail([
      {
        file: path,
        message: `front matter의 YAML 문법이 틀렸어요(${line}번째 줄). 콜론(:) 뒤에 공백이 있는지, 따옴표 짝이 맞는지, 같은 항목이 두 번 있지 않은지 확인해 주세요.`,
      },
    ]);
  }
  const raw = doc.toJS() ?? {};
  if (!isRecord(raw))
    return fail([{ file: path, message: 'front matter는 `이름: 값` 줄로 써야 해요.' }]);
  return { ok: true, value: { data: raw, body: normalizeBody(source.slice(match[0].length)) } };
}

/** YAML 1.1 도구가 글자가 아닌 값(불리언, null, 날짜, 숫자)으로 읽을 수 있는 글자. */
const YAML11_AMBIGUOUS = [
  /^(?:y|n|yes|no|true|false|on|off|null|~)$/i,
  /^\d{4}-\d{1,2}-\d{1,2}(?:[Tt ].*)?$/,
  /^[-+]?\d[\d_]*(?::[0-5]?\d)+(?:\.[\d_]*)?$/,
  /^[-+]?0[0-7_]+$/,
  /^[-+]?0b[01_]+$/i,
  /^[-+]?\d[\d_]*(?:\.[\d_]*)?(?:e[-+]?\d+)?$/i,
];

function joinFrontMatter(data: Record<string, unknown>, body: string): string {
  const doc = new YAML.Document(data);
  // 따옴표를 붙여 둬야 YAML 1.1로 읽는 도구(gray-matter 등)도 같은 글자로 읽는다.
  YAML.visit(doc, {
    Scalar(_key, node) {
      if (
        typeof node.value === 'string' &&
        YAML11_AMBIGUOUS.some((re) => re.test(node.value as string))
      )
        node.type = 'QUOTE_DOUBLE';
    },
  });
  const head = `---\n${doc.toString({ lineWidth: 0 })}---\n`;
  const content = normalizeBody(body);
  return content ? `${head}\n${content}` : head;
}

function markdownCollection<T extends { slug: Slug; body: string; extra: Extra }>(
  dir: string,
  schema: z.ZodType,
  keys: readonly string[],
  slugIssues: (path: string, slug: Slug) => ContentIssue[] = () => [],
): MarkdownCollection<T> {
  const prefix = `${dir}/`;
  const rawPath = (slug: string) => `${prefix}${slug}.md`;
  // 검사하지 않은 값으로 `content/posts/../../x.md` 같은 경로가 만들어지지 않게 한다.
  const pathFor = (slug: string) => {
    if (!isSlug(slug))
      throw new ContentError([
        {
          file: rawPath(slug),
          message: `주소 '${slug}'는 규칙에 맞지 않아 파일 경로를 만들 수 없어요. validate를 통과한 주소만 써 주세요.`,
        },
      ]);
    return rawPath(slug);
  };

  const validate = (
    slug: string,
    frontMatter: Record<string, unknown>,
    body: string,
  ): Result<T> => {
    const path = rawPath(slug);
    if (!isSlug(slug)) {
      const suggestion = slugify(slug);
      return fail([
        {
          file: path,
          message: `파일 이름이 주소 규칙에 맞지 않아요. 파일 이름이 주소가 되므로 영문 소문자, 숫자, 하이픈(-)만 써 주세요.${suggestion ? ` 예: ${suggestion}.md` : ''}`,
        },
      ]);
    }
    const reserved = slugIssues(path, slug as Slug);
    if (reserved.length) return fail(reserved);
    // `summary:`처럼 값을 비워 둔 줄은 YAML에서 null이 된다. 표에 있는 항목이면 없는 것으로 본다.
    // 파일을 읽을 때와 화면 값을 검사할 때 같은 규칙이다. 테마가 더한 항목의 null은 그대로 둔다.
    const known = Object.fromEntries(
      Object.entries(frontMatter).filter(([key, value]) => !(keys.includes(key) && value === null)),
    );
    const front = parseWith(path, schema, known);
    if (!front.ok) return front;
    const doc = {
      ...(front.value as object),
      slug,
      body: normalizeBody(body),
      extra: extraOf(frontMatter, keys),
    };
    return { ok: true, value: doc as T };
  };

  return {
    dir,
    pathFor,
    validate,
    parse(path, text) {
      const name = path.slice(prefix.length);
      if (!path.startsWith(prefix) || !name.endsWith('.md') || name.includes('/'))
        return fail([
          {
            file: path,
            message: `${dir}/ 폴더 바로 아래의 .md 파일이어야 해요. 파일을 옮기거나 확장자를 .md로 바꿔 주세요.`,
          },
        ]);
      const split = splitFrontMatter(path, text);
      if (!split.ok) return split;
      return validate(name.slice(0, -'.md'.length), split.value.data, split.value.body);
    },
    serialize({ slug: _slug, body, extra, ...front }) {
      return joinFrontMatter(ordered(keys, normalizeFront(front), extra), body);
    },
  };
}

/** 빈 태그 목록은 쓰지 않는다. 파일을 짧게 두고 `tags: []` 유무로 diff가 생기지 않게 한다. */
function normalizeFront(front: Record<string, unknown>): Record<string, unknown> {
  const { tags, ...rest } = front;
  return Array.isArray(tags) && tags.length === 0 ? rest : front;
}

/* ---------- lbs.json의 스키마 버전 ---------- */

const MANIFEST_PATH = 'lbs.json';

function versionIssues({ schemaVersion: version }: { schemaVersion: number }): ContentIssue[] {
  if (version >= MIN_SCHEMA_VERSION && version <= SCHEMA_VERSION) return [];
  const message =
    version > SCHEMA_VERSION
      ? `이 블로그는 콘텐츠 스키마 ${version}버전으로 만들어졌어요. 지금 LBS는 ${SCHEMA_VERSION}버전까지 읽을 수 있어요. LBS를 새 버전으로 올려 주세요.`
      : `콘텐츠 스키마 ${version}버전은 더 이상 읽을 수 없어요. 블로그 저장소를 ${SCHEMA_VERSION}버전으로 옮겨 주세요.`;
  return [{ file: MANIFEST_PATH, field: 'schemaVersion', message }];
}

/** 블로그 저장소의 스키마 버전을 이 패키지가 읽을 수 있는지 확인한다. 읽을 수 없으면 ContentError를 던진다. */
export function assertSupportedVersion(manifest: { schemaVersion: number }): void {
  const issues = versionIssues(manifest);
  if (issues.length) throw new ContentError(issues);
}

/* ---------- 블로그 저장소의 파일 배치 ---------- */

/** CMS와 블로그 빌드가 읽어서 해석하는 텍스트 파일인지. 미디어, 테마 코드, 워크플로는 아니다. */
export function isSiteSource(path: string): boolean {
  return path === MANIFEST_PATH || path.startsWith('content/') || path === 'theme/tokens.json';
}

/**
 * 블로그 저장소에서 CMS와 블로그가 함께 읽고 쓰는 파일. 경로, 읽기, 쓰기를 이 표 한 곳에서 정한다.
 * 미디어 파일 자체는 `public/media/<연>/<월>/<파일>`에 있고, 콘텐츠에서는 `/media/...`로 가리킨다.
 */
export const blogFiles = {
  manifest: jsonFile(MANIFEST_PATH, ManifestSchema, versionIssues),
  info: extensibleJsonFile('content/site.json', SiteInfoSchema),
  categories: jsonFile('content/categories.json', CategoriesSchema),
  navigation: jsonFile('content/navigation.json', NavigationSchema),
  redirects: jsonFile('content/redirects.json', RedirectsSchema),
  media: jsonFile('content/media.json', MediaLibrarySchema),
  /** 스키마 1(템플릿 0.1) 블로그의 `theme/tokens.json`. 스키마 2에는 없다. */
  legacyTheme: extensibleJsonFile('theme/tokens.json', ThemeTokensSchema),
  /** 스키마 2 블로그의 쓰는 테마와 테마별 설정값. */
  themeState: jsonFile('content/theme.json', ThemeStateSchema),
  posts: markdownCollection<Post>('content/posts', PostFrontMatterSchema, POST_KEYS),
  pages: markdownCollection<Page>(
    'content/pages',
    PageFrontMatterSchema,
    PAGE_KEYS,
    (path, slug) =>
      RESERVED_PAGE_SLUGS.has(slug)
        ? [
            {
              file: path,
              message: `파일 이름 ${slug}.md는 쓸 수 없어요. /${slug}/ 주소는 블로그가 쓰고 있어요. 다른 파일 이름으로 바꿔 주세요.`,
            },
          ]
        : [],
  ),
};
