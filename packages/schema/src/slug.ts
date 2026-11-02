import { z } from 'zod';

export const SLUG_MAX_LENGTH = 80;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

export const SlugSchema = z
  .string()
  .refine(isSlug, { params: { rule: 'slug' } })
  .brand<'Slug'>();

export type Slug = z.infer<typeof SlugSchema>;

// 글자대로 옮기는 국어의 로마자 표기법(소리 변화 규칙은 적용하지 않는다).
const INITIALS = 'g kk n d tt r m b pp s ss _ j jj ch k t p h'.split(' ');
const MEDIALS = 'a ae ya yae eo e yeo ye o wa wae oe yo u wo we wi yu eu ui i'.split(' ');
const FINALS = '_ k k k n n n t l k m l l l p l m p p t t ng t t k t p t'.split(' ');
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;

function romanizeSyllable(code: number): string {
  const index = code - HANGUL_FIRST;
  const parts = [
    INITIALS[Math.floor(index / 588)],
    MEDIALS[Math.floor((index % 588) / 28)],
    FINALS[index % 28],
  ];
  return parts.map((part) => (part === '_' ? '' : (part ?? ''))).join('');
}

/** 제목에서 주소를 만든다. 쓸 수 있는 글자가 하나도 없으면 undefined를 돌려준다. */
export function slugify(title: string): Slug | undefined {
  let text = '';
  for (const char of title.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0;
    text +=
      code >= HANGUL_FIRST && code <= HANGUL_LAST
        ? romanizeSyllable(code)
        : char.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  }
  const slug = text
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  return isSlug(slug) ? (slug as Slug) : undefined;
}

/** `taken`에 없는 주소를 돌려준다. 겹치면 `-2`, `-3`을 붙인다. */
export function uniqueSlug(base: Slug, taken: ReadonlySet<string>): Slug {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate as Slug;
  }
}
