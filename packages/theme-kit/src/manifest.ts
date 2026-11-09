/**
 * 테마 묶음의 `theme.json`(이름, 버전, 계약 버전, 설정 정의)과 설정 값 검사.
 *
 * 블로그 빌드 전의 검사(`src/theme-entry/*.mjs`, 그냥 Node)도 이 파일을 불러온다. 그래서 이 파일은 다른 파일을 가져오지 않고,
 * Node가 타입만 지우고 바로 실행할 수 있는 문법만 쓴다(enum, namespace, 매개변수 속성 없음).
 */

/** 이 패키지가 정한 테마 계약 버전(`major.minor`). 템플릿 버전과 따로 움직인다. */
export const THEME_CONTRACT = '1.0';

/** 이 블로그 템플릿이 그릴 수 있는 계약. major가 같고 테마가 요구하는 minor가 `maxMinor` 이하면 맞다. */
export const SUPPORTED_CONTRACT = { major: 1, maxMinor: 0 } as const;

/** 기본 테마 id. 템플릿이 넣는 `themes/default/`가 쓰므로 올린 테마는 쓸 수 없다. */
export const DEFAULT_THEME_ID = 'default';

/** 테마 id이자 폴더 이름. 영문 소문자로 시작하거나 숫자로 시작하고, 영문 소문자·숫자·하이픈 2~40자 */
export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && THEME_ID.test(value);
}

const THEME_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const CONTRACT_FORMAT = /^(\d+)\.(\d+)$/;
const SETTING_KEY = /^[a-z][a-zA-Z0-9]{0,39}$/;
const CSS_VARIABLE = /^--[a-zA-Z0-9-]+$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const UNIT = /^[a-z%]{1,8}$/;
const HTTP_URL = /^https?:\/\/\S+$/i;
const MEDIA_PATH = /^\/media\//;
const UNSAFE_CSS_VALUE = /[;{}<>\\]/;
const MAX_SETTINGS = 30;
const DEFAULT_TEXT_MAX_LENGTH = 200;
const SETTING_GROUPS = ['site', 'home', 'post'];
const SETTING_TYPES = ['color', 'number', 'select', 'boolean', 'text', 'image'];
const CSS_TYPES = ['color', 'number', 'select'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 문구에 넣는 현재 값. 길면 자른다. */
function show(value: unknown): string {
  if (value === undefined) return '없음';
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    text = undefined;
  }
  text ??= String(value);
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

/**
 * 설정 값이 정의에 맞는지. 기본값 검사와 저장된 값 검사가 같은 규칙을 쓴다.
 * 맞으면 undefined, 아니면 무엇이 틀렸고 어떻게 고치는지 담은 문구.
 */
function valueProblem(definition: SettingDefinition, value: unknown): string | undefined {
  const current = `현재 값: ${show(value)}`;
  switch (definition.type) {
    case 'color':
      return typeof value === 'string' && COLOR.test(value)
        ? undefined
        : `색은 #과 16진수 6자리로 써야 해요(예: #ff6f0f). ${current}`;
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `숫자여야 해요. ${current}`;
      const { min, max, step } = definition;
      if (min !== undefined && value < min) return `${min} 이상이어야 해요. ${current}`;
      if (max !== undefined && value > max) return `${max} 이하여야 해요. ${current}`;
      if (step !== undefined && step > 0) {
        const steps = (value - (min ?? 0)) / step;
        if (Math.abs(steps - Math.round(steps)) > 1e-9)
          return `${min ?? 0}에서 ${step}씩 늘어나는 값이어야 해요. ${current}`;
      }
      return undefined;
    }
    case 'select': {
      const values = definition.options.map((option) => option.value);
      return typeof value === 'string' && values.includes(value)
        ? undefined
        : `선택지 중 하나여야 해요(${values.join(', ')}). ${current}`;
    }
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `true나 false여야 해요. ${current}`;
    case 'text': {
      if (typeof value !== 'string') return `글자여야 해요. ${current}`;
      const max = definition.maxLength ?? DEFAULT_TEXT_MAX_LENGTH;
      return value.length <= max ? undefined : `${max}자 이하여야 해요. ${current}`;
    }
    case 'image':
      return value === null || (typeof value === 'string' && MEDIA_PATH.test(value))
        ? undefined
        : `비우거나(null) /media/로 시작하는 미디어 경로여야 해요. ${current}`;
  }
}

class Collector {
  issues: ThemeIssue[] = [];

  add(field: string | undefined, message: string) {
    this.issues.push(field === undefined ? { message } : { field, message });
  }

  /** 글자 항목 하나를 읽는다. 문제가 있으면 담고 undefined를 돌려준다. */
  text(
    source: Record<string, unknown>,
    key: string,
    path: string,
    options: { required: boolean; min: number; max: number; trim?: boolean },
  ): string | undefined {
    const raw = source[key];
    const field = `${path}${key}`;
    if (raw === undefined) {
      if (options.required)
        this.add(field, `${key} 항목이 없어요. ${options.min}~${options.max}자 글자로 채우세요.`);
      return undefined;
    }
    if (typeof raw !== 'string') {
      this.add(field, `${key} 항목은 글자여야 해요. 현재 값: ${show(raw)}`);
      return undefined;
    }
    const value = options.trim ? raw.trim() : raw;
    if (value.length < options.min || value.length > options.max) {
      this.add(
        field,
        `${key} 항목은 ${options.min}~${options.max}자여야 해요. 지금은 ${value.length}자예요.`,
      );
      return undefined;
    }
    return value;
  }

  /** 정규식에 맞는 글자 항목 하나를 읽는다. */
  pattern(
    source: Record<string, unknown>,
    key: string,
    path: string,
    regex: RegExp,
    required: boolean,
    hint: string,
  ): string | undefined {
    const raw = source[key];
    const field = `${path}${key}`;
    if (raw === undefined) {
      if (required) this.add(field, `${key} 항목이 없어요. ${hint}`);
      return undefined;
    }
    if (typeof raw !== 'string' || !regex.test(raw)) {
      this.add(field, `${key} 항목이 맞지 않아요. ${hint} 현재 값: ${show(raw)}`);
      return undefined;
    }
    return raw;
  }

  number(
    source: Record<string, unknown>,
    key: string,
    path: string,
    required: boolean,
  ): number | undefined {
    const raw = source[key];
    const field = `${path}${key}`;
    if (raw === undefined) {
      if (required) this.add(field, `${key} 항목이 없어요. 숫자를 쓰세요.`);
      return undefined;
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      this.add(field, `${key} 항목은 숫자여야 해요. 현재 값: ${show(raw)}`);
      return undefined;
    }
    return raw;
  }
}

function parseOptions(raw: unknown, path: string, c: Collector): SelectOption[] | undefined {
  const field = `${path}options`;
  if (!Array.isArray(raw) || raw.length === 0) {
    c.add(
      field,
      'options 항목은 선택지가 하나 이상 든 목록이어야 해요. { value, label } 모양으로 채우세요.',
    );
    return undefined;
  }
  const before = c.issues.length;
  const options: SelectOption[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    const at = `${field}[${index}]`;
    if (!isObject(item)) {
      c.add(at, `선택지는 { value, label } 모양이어야 해요. 현재 값: ${show(item)}`);
      return;
    }
    const value = c.text(item, 'value', `${at}.`, { required: true, min: 1, max: 60 });
    const label = c.text(item, 'label', `${at}.`, { required: true, min: 1, max: 40, trim: true });
    let css: string | undefined;
    if (item.css !== undefined) {
      if (typeof item.css !== 'string' || item.css === '' || UNSAFE_CSS_VALUE.test(item.css)) {
        c.add(
          `${at}.css`,
          `css 항목은 ; { } < > \\를 뺀 CSS 값이어야 해요. 현재 값: ${show(item.css)}`,
        );
      } else {
        css = item.css;
      }
    }
    if (value !== undefined) {
      if (seen.has(value))
        c.add(`${at}.value`, `value가 다른 선택지와 겹쳐요. 현재 값: ${show(value)}`);
      seen.add(value);
    }
    if (value !== undefined && label !== undefined) {
      options.push(css === undefined ? { value, label } : { value, label, css });
    }
  });
  return c.issues.length === before ? options : undefined;
}

/** 설정 하나를 읽는다. 문제는 `c`에 모으고, 이 설정에 문제가 있으면 undefined. */
function parseSetting(raw: unknown, index: number, keys: Set<string>, c: Collector) {
  const path = `settings[${index}]`;
  if (!isObject(raw)) {
    c.add(path, `설정은 { key, label, type, default } 모양이어야 해요. 현재 값: ${show(raw)}`);
    return undefined;
  }
  const before = c.issues.length;
  const prefix = `${path}.`;

  const key = c.pattern(
    raw,
    'key',
    prefix,
    SETTING_KEY,
    true,
    '영문 소문자로 시작하는 영문·숫자 1~40자로 쓰세요(예: accentColor).',
  );
  if (key !== undefined) {
    if (keys.has(key)) c.add(`${prefix}key`, `key가 다른 설정과 겹쳐요. 현재 값: ${show(key)}`);
    keys.add(key);
  }
  const label = c.text(raw, 'label', prefix, { required: true, min: 1, max: 40, trim: true });
  const description = c.text(raw, 'description', prefix, { required: false, min: 0, max: 200 });
  let group: SettingGroup | undefined;
  if (raw.group !== undefined) {
    if (typeof raw.group === 'string' && SETTING_GROUPS.includes(raw.group)) {
      group = raw.group as SettingGroup;
    } else {
      c.add(
        `${prefix}group`,
        `group 항목은 site, home, post 중 하나여야 해요. 현재 값: ${show(raw.group)}`,
      );
    }
  }

  const type = raw.type;
  if (typeof type !== 'string' || !SETTING_TYPES.includes(type)) {
    c.add(
      `${prefix}type`,
      `type 항목은 color, number, select, boolean, text, image 중 하나여야 해요. 현재 값: ${show(type)}`,
    );
    return undefined;
  }

  let css: string | undefined;
  if (raw.css !== undefined) {
    if (!CSS_TYPES.includes(type)) {
      c.add(
        `${prefix}css`,
        `css 항목은 color, number, select 설정에만 쓸 수 있어요. ${type} 설정에서는 지우세요.`,
      );
    } else {
      css = c.pattern(
        raw,
        'css',
        prefix,
        CSS_VARIABLE,
        false,
        '--로 시작하는 CSS 변수 이름이어야 해요(예: --accent).',
      );
    }
  }

  const base = { key: key ?? '', label: label ?? '', description, group, css };
  let definition: SettingDefinition | undefined;
  const defaultField = `${prefix}default`;

  if (type === 'color' || type === 'boolean' || type === 'image' || type === 'text') {
    let extra: { maxLength?: number } = {};
    if (type === 'text' && raw.maxLength !== undefined) {
      const max = raw.maxLength;
      if (typeof max === 'number' && Number.isInteger(max) && max >= 1 && max <= 2000) {
        extra = { maxLength: max };
      } else {
        c.add(
          `${prefix}maxLength`,
          `maxLength 항목은 1~2000 사이 정수여야 해요. 현재 값: ${show(max)}`,
        );
      }
    }
    definition = { ...base, ...extra, type, default: raw.default } as SettingDefinition;
  } else if (type === 'number') {
    const min = c.number(raw, 'min', prefix, false);
    const max = c.number(raw, 'max', prefix, false);
    const step = c.number(raw, 'step', prefix, false);
    if (step !== undefined && step <= 0) {
      c.add(`${prefix}step`, `step 항목은 0보다 커야 해요. 현재 값: ${show(step)}`);
    }
    if (min !== undefined && max !== undefined && min > max) {
      c.add(`${prefix}min`, `min(${min})이 max(${max})보다 커요. min을 max 이하로 고치세요.`);
    }
    const unit = c.pattern(
      raw,
      'unit',
      prefix,
      UNIT,
      false,
      '영문 소문자나 %로 1~8자여야 해요(예: px, rem, %).',
    );
    definition = {
      ...base,
      type,
      default: raw.default,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
      ...(step === undefined || step <= 0 ? {} : { step }),
      ...(unit === undefined ? {} : { unit }),
    } as SettingDefinition;
  } else {
    const options = parseOptions(raw.options, prefix, c);
    if (options !== undefined) {
      definition = { ...base, type: 'select', default: raw.default, options } as SettingDefinition;
    }
  }

  if (definition !== undefined) {
    if (raw.default === undefined) {
      c.add(defaultField, 'default 항목이 없어요. 기본값을 채우세요.');
    } else {
      const problem = valueProblem(definition, raw.default);
      if (problem !== undefined) c.add(defaultField, `기본값이 맞지 않아요. ${problem}`);
    }
  }

  if (c.issues.length > before) return undefined;
  return stripUndefined(definition as SettingDefinition);
}

/** `description: undefined`처럼 비어 있는 항목을 뺀다. JSON으로 옮길 때 값이 달라지지 않게 한다. */
function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export type SettingGroup = 'site' | 'home' | 'post';

interface SettingBase {
  /** `props.settings`의 키. `^[a-z][a-zA-Z0-9]{0,39}$` */
  key: string;
  /** CMS 양식의 이름, 1~40자 */
  label: string;
  description?: string;
  /** CMS 양식의 묶음 */
  group?: SettingGroup;
}

/** 값을 `:root`의 CSS 변수로도 내는 설정. `css`는 `--`로 시작하는 변수 이름이다. color, number, select만 쓸 수 있다. */
interface CssSetting {
  css?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  /** 이 선택지를 골랐을 때 CSS 변수에 쓰는 값. 없으면 `value` */
  css?: string;
}

export type SettingDefinition =
  /** `#`과 16진수 6자리 */
  | (SettingBase & CssSetting & { type: 'color'; default: string })
  /** CSS 변수 값은 숫자 뒤에 `unit`을 붙인 것이다 */
  | (SettingBase &
      CssSetting & {
        type: 'number';
        default: number;
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
      })
  | (SettingBase & CssSetting & { type: 'select'; default: string; options: SelectOption[] })
  | (SettingBase & { type: 'boolean'; default: boolean })
  /** `maxLength` 기본 200자 */
  | (SettingBase & { type: 'text'; default: string; maxLength?: number })
  /** 미디어 경로(`/media/2026/10/a.png`). 템플릿이 기준 경로를 붙인 주소로 바꿔 넘긴다 */
  | (SettingBase & { type: 'image'; default: string | null });

export interface ThemeManifest {
  /** 폴더 이름과 같다 */
  id: string;
  name: string;
  /** SemVer */
  version: string;
  /** 이 테마가 요구하는 계약(`1.0`이면 1.0 이상 2.0 미만) */
  contract: string;
  description?: string;
  author?: { name: string; url?: string };
  license?: string;
  /** 30개까지. 없으면 빈 목록 */
  settings: SettingDefinition[];
}

export type SettingValue = string | number | boolean | null;

/** 문제 하나. 파일은 부르는 쪽이 붙인다. `field`는 `settings[2].default`, `accent`처럼 그 파일 안의 위치다. */
export interface ThemeIssue {
  field?: string;
  message: string;
}

export type ThemeResult<T> = { ok: true; value: T } | { ok: false; issues: ThemeIssue[] };

/** `theme.json`을 읽은 값(JSON.parse 결과)을 검사한다. 모르는 최상위 항목은 무시한다. 문제를 모두 모아 돌려준다. */
export function parseThemeManifest(data: unknown): ThemeResult<ThemeManifest> {
  if (!isObject(data)) {
    return {
      ok: false,
      issues: [
        {
          message: `theme.json은 { id, name, version, contract } 모양의 객체여야 해요. 현재 값: ${show(data)}`,
        },
      ],
    };
  }
  const c = new Collector();
  const id = data.id;
  if (!isThemeId(id)) {
    c.add(
      'id',
      `id는 영문 소문자나 숫자로 시작하는 영문 소문자·숫자·하이픈 2~40자여야 해요(예: my-theme). 현재 값: ${show(id)}`,
    );
  }
  const name = c.text(data, 'name', '', { required: true, min: 1, max: 60, trim: true });
  const version = c.pattern(
    data,
    'version',
    '',
    SEMVER,
    true,
    '1.0.0, 1.2.0-beta.1처럼 SemVer로 쓰세요.',
  );
  const contract = c.pattern(
    data,
    'contract',
    '',
    CONTRACT_FORMAT,
    true,
    '1.0처럼 주 버전.보조 버전으로 쓰세요.',
  );
  const description = c.text(data, 'description', '', { required: false, min: 0, max: 300 });
  const license = c.text(data, 'license', '', { required: false, min: 0, max: 60 });

  let author: ThemeManifest['author'];
  if (data.author !== undefined) {
    if (!isObject(data.author)) {
      c.add('author', `author는 { name, url } 모양이어야 해요. 현재 값: ${show(data.author)}`);
    } else {
      const authorName = c.text(data.author, 'name', 'author.', {
        required: true,
        min: 1,
        max: 60,
        trim: true,
      });
      const url = c.pattern(
        data.author,
        'url',
        'author.',
        HTTP_URL,
        false,
        'http나 https로 시작하는 주소여야 해요.',
      );
      if (authorName !== undefined)
        author = url === undefined ? { name: authorName } : { name: authorName, url };
    }
  }

  const settings: SettingDefinition[] = [];
  const rawSettings = data.settings ?? [];
  if (!Array.isArray(rawSettings)) {
    c.add('settings', `settings는 설정 정의 목록이어야 해요. 현재 값: ${show(rawSettings)}`);
  } else {
    if (rawSettings.length > MAX_SETTINGS) {
      c.add(
        'settings',
        `설정은 ${MAX_SETTINGS}개까지 둘 수 있어요. 지금은 ${rawSettings.length}개예요. 줄이세요.`,
      );
    }
    const keys = new Set<string>();
    rawSettings.forEach((raw, index) => {
      const setting = parseSetting(raw, index, keys, c);
      if (setting !== undefined) settings.push(setting);
    });
  }

  if (c.issues.length > 0) return { ok: false, issues: c.issues };
  const value: ThemeManifest = {
    id: id as string,
    name: name as string,
    version: version as string,
    contract: contract as string,
    ...(description === undefined ? {} : { description }),
    ...(author === undefined ? {} : { author }),
    ...(license === undefined ? {} : { license }),
    settings,
  };
  return { ok: true, value };
}

/**
 * 테마가 요구하는 계약(`theme.json`의 `contract`)을 이 템플릿이 그릴 수 있는지. 맞으면 undefined,
 * 아니면 무엇이 다르고 어떻게 고치는지 담은 문구. `templateVersion`은 블로그의 `lbs.json` 값이다.
 */
export function contractIssue(required: string, templateVersion: string): string | undefined {
  const match = CONTRACT_FORMAT.exec(required);
  if (!match) {
    return `테마 계약 버전 형식이 맞지 않아요. 현재 값: ${show(required)}. 1.0처럼 주 버전.보조 버전으로 쓰세요.`;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const { major: supportedMajor, maxMinor } = SUPPORTED_CONTRACT;
  if (major === supportedMajor && minor <= maxMinor) return undefined;
  const supported = `${supportedMajor}.${maxMinor}`;
  if (major < supportedMajor) {
    return `이 테마는 테마 계약 ${required} 버전용인데 블로그 템플릿(${templateVersion} 버전)은 계약 ${supportedMajor}.x만 지원해요. 계약 ${supportedMajor}.x용으로 만든 테마 버전을 올리세요.`;
  }
  return `이 테마는 테마 계약 ${required} 버전이 필요한데 블로그 템플릿(${templateVersion} 버전)은 ${supported} 버전까지 지원해요. 블로그 템플릿을 올리거나 계약 ${supportedMajor}.x용 테마 버전을 올리세요.`;
}

export interface ResolvedSettings {
  /** 정의마다 저장된 값, 없거나 틀리면 기본값 */
  values: Record<string, SettingValue>;
  /** `css`가 있는 정의의 CSS 변수 이름 -> 값 */
  cssVariables: Record<string, string>;
  /** 정의에 맞지 않은 저장 값. `field`는 설정 키다 */
  issues: ThemeIssue[];
}

/**
 * 저장된 설정 값(`content/theme.json`의 `settings.<id>`)을 정의로 검사하고 기본값을 채운다. 정의에 없는 키는 무시한다
 * (지우지 않는다. 같은 테마의 옛 버전으로 돌아가면 다시 쓰인다). 틀린 값은 기본값으로 바꾸고 `issues`에 담는다.
 * 빌드는 `issues`가 있으면 멈추고, 미리보기는 기본값으로 그린다. 그래서 문구에는 무엇이 틀렸는지만 쓴다.
 */
export function resolveSettings(
  definitions: readonly SettingDefinition[],
  stored: unknown,
): ResolvedSettings {
  const issues: ThemeIssue[] = [];
  let source: Record<string, unknown> = {};
  if (isObject(stored)) {
    source = stored;
  } else if (stored !== undefined) {
    issues.push({
      message: `설정은 { 키: 값 } 모양이어야 해요. 현재 값: ${show(stored)}`,
    });
  }
  const values: Record<string, SettingValue> = {};
  const cssVariables: Record<string, string> = {};
  for (const definition of definitions) {
    let value: SettingValue = definition.default;
    if (Object.hasOwn(source, definition.key) && source[definition.key] !== undefined) {
      const candidate = source[definition.key];
      const problem = valueProblem(definition, candidate);
      if (problem === undefined) {
        value = candidate as SettingValue;
      } else {
        issues.push({
          field: definition.key,
          message: problem,
        });
      }
    }
    values[definition.key] = value;
    if ('css' in definition && definition.css !== undefined) {
      cssVariables[definition.css] = cssValue(definition, value);
    }
  }
  return { values, cssVariables, issues };
}

function cssValue(definition: SettingDefinition, value: SettingValue): string {
  if (definition.type === 'number') return `${value}${definition.unit ?? ''}`;
  if (definition.type === 'select') {
    const option = definition.options.find((item) => item.value === value);
    return option?.css ?? String(value);
  }
  return String(value);
}
