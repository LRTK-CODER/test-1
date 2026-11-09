import { z } from 'zod';
import { type Slug, SlugSchema } from './slug';

/** 새 블로그 저장소가 따르는 콘텐츠 스키마 버전. 파일 모양이 호환되지 않게 바뀔 때만 올린다. */
export const SCHEMA_VERSION = 2;

/** 읽을 수 있는 가장 낮은 스키마 버전. 1은 템플릿 0.1 블로그로, 2로 옮기는 작업 전까지 읽는다. */
export const MIN_SCHEMA_VERSION = 1;

const text = (max: number) => z.string().trim().min(1).max(max);

export const IsoDateTimeSchema = z.iso.datetime({ offset: true }).brand<'IsoDateTime'>();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

const MEDIA_PATTERN =
  /^\/media\/\d{4}\/(?:0[1-9]|1[0-2])\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|gif)$/;
export const MediaPathSchema = z
  .string()
  .refine((value) => MEDIA_PATTERN.test(value), { params: { rule: 'mediaPath' } })
  .brand<'MediaPath'>();
export type MediaPath = z.infer<typeof MediaPathSchema>;

/* ---------- lbs.json ---------- */

export const ManifestSchema = z.object({
  schemaVersion: z.number().int(),
  templateVersion: z.string().refine((value) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value), {
    params: { rule: 'semver' },
  }),
});
export type Manifest = z.infer<typeof ManifestSchema>;

/* ---------- content/site.json ---------- */

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const SiteInfoSchema = z.object({
  name: text(60),
  tagline: text(120).optional(),
  description: text(300).optional(),
  shareImage: MediaPathSchema.optional(),
  language: z
    .string()
    .refine((value) => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value), { params: { rule: 'language' } }),
  timeZone: z.string().refine(isTimeZone, { params: { rule: 'timeZone' } }),
});

/* ---------- content/categories.json ---------- */

export const CategorySchema = z.strictObject({ slug: SlugSchema, name: text(40) });
export type Category = z.infer<typeof CategorySchema>;
export const CategoriesSchema = z.strictObject({ items: z.array(CategorySchema) });
export type Categories = z.infer<typeof CategoriesSchema>;

/* ---------- content/navigation.json ---------- */

const label = text(40);
const navLinkOptions = [
  z.strictObject({ type: z.literal('home'), label }),
  z.strictObject({ type: z.literal('post'), label, slug: SlugSchema }),
  z.strictObject({ type: z.literal('category'), label, slug: SlugSchema }),
  z.strictObject({ type: z.literal('page'), label, slug: SlugSchema }),
  z.strictObject({
    type: z.literal('external'),
    label,
    url: z.url({ protocol: /^https?$/ }),
    newTab: z.boolean().optional(),
  }),
] as const;
export const NavLinkSchema = z.discriminatedUnion('type', [...navLinkOptions]);
export type NavLink = z.infer<typeof NavLinkSchema>;

export const NavGroupSchema = z.strictObject({
  type: z.literal('group'),
  label,
  children: z.array(NavLinkSchema).min(1),
});
export type NavGroup = z.infer<typeof NavGroupSchema>;

export const NavigationSchema = z.strictObject({
  items: z.array(z.discriminatedUnion('type', [...navLinkOptions, NavGroupSchema])),
});
export type Navigation = z.infer<typeof NavigationSchema>;
export type NavItem = Navigation['items'][number];

/* ---------- content/redirects.json ---------- */

export const RedirectSchema = z.strictObject({
  type: z.enum(['post', 'category', 'page']),
  from: SlugSchema,
  to: SlugSchema,
});
export type Redirect = z.infer<typeof RedirectSchema>;
export const RedirectsSchema = z.strictObject({ items: z.array(RedirectSchema) });
export type Redirects = z.infer<typeof RedirectsSchema>;

/* ---------- content/media.json ---------- */

export const MediaLibrarySchema = z.strictObject({
  items: z.record(MediaPathSchema, z.strictObject({ alt: z.string().trim().max(300) })),
});
export type MediaLibrary = z.infer<typeof MediaLibrarySchema>;

/* ---------- theme/tokens.json (스키마 1, 템플릿 0.1 블로그에만 있다) ---------- */

export const BODY_FONT_IDS = ['system', 'noto-sans-kr', 'ibm-plex-sans-kr'] as const;
export type BodyFont = (typeof BODY_FONT_IDS)[number];

export const ThemeTokensSchema = z.object({
  accent: z
    .string()
    .refine((value) => /^#[0-9a-fA-F]{6}$/.test(value), { params: { rule: 'hexColor' } }),
  imageRadius: z.number().int().min(0).max(48),
  bodyFont: z.enum(BODY_FONT_IDS),
});

/* ---------- content/theme.json (스키마 2) ---------- */

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
const themeIdText = z
  .string()
  .refine((value) => THEME_ID_PATTERN.test(value), { params: { rule: 'themeId' } });

export const ThemeIdSchema = themeIdText.brand<'ThemeId'>();
export type ThemeId = z.infer<typeof ThemeIdSchema>;
export const DEFAULT_THEME_ID = 'default' as ThemeId;

const SettingValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type SettingValue = z.infer<typeof SettingValueSchema>;

/** 쓰는 테마와 테마별 설정값. 설정값이 테마가 정한 항목에 맞는지는 블로그 템플릿이 검사한다. */
export const ThemeStateSchema = z.strictObject({
  active: ThemeIdSchema,
  settings: z.record(themeIdText, z.record(z.string(), SettingValueSchema)).default({}),
});
export type ThemeState = z.infer<typeof ThemeStateSchema>;

/* ---------- content/posts/<slug>.md, content/pages/<slug>.md ---------- */

export const POST_STATUSES = ['draft', 'review', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

const postFields = {
  title: text(200),
  category: SlugSchema,
  tags: z.array(text(30)).max(20).default([]),
  summary: text(120).optional(),
  cover: MediaPathSchema.optional(),
  author: text(60).optional(),
};

export const PostFrontMatterSchema = z.discriminatedUnion('status', [
  z.object({
    ...postFields,
    status: z.enum(['draft', 'review']),
    publishAt: IsoDateTimeSchema.optional(),
  }),
  z.object({ ...postFields, status: z.literal('published'), publishAt: IsoDateTimeSchema }),
]);

/** front matter에 쓰는 순서. 저장할 때 이 순서를 지켜 diff를 작게 둔다. */
export const POST_KEYS = [...Object.keys(postFields), 'status', 'publishAt'];

export const PageFrontMatterSchema = z.object({
  title: text(200),
  summary: text(120).optional(),
  status: z.enum(['draft', 'published']),
});
export const PAGE_KEYS = Object.keys(PageFrontMatterSchema.shape);

/** 고정 페이지 주소로 쓸 수 없는 이름. 블로그가 이 경로를 쓴다. */
export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set(['posts', 'category', 'media']);

/** 지우지 않는 시스템 페이지. 없는 주소로 들어왔을 때 보인다. */
export const NOT_FOUND_PAGE_SLUG = '404' as Slug;

/** front matter나 JSON 최상위에 테마가 더 넣은 항목. CMS는 읽은 그대로 다시 쓴다. */
export type Extra = Record<string, unknown>;

export type Post = z.infer<typeof PostFrontMatterSchema> & {
  slug: Slug;
  body: string;
  extra: Extra;
};
export type Page = z.infer<typeof PageFrontMatterSchema> & {
  slug: Slug;
  body: string;
  extra: Extra;
};
export type SiteInfo = z.infer<typeof SiteInfoSchema> & { extra: Extra };
export type ThemeTokens = z.infer<typeof ThemeTokensSchema> & { extra: Extra };
