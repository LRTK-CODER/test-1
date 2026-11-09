import {
  absoluteUrl,
  type MediaPath,
  type Page,
  type Post,
  type Route,
  routePath,
} from '@lbs/schema';
import type { Metadata } from 'next';
import { type Blog, coverAlt } from './blog';

/** 사이트 설명, 없으면 한 줄 소개. 설명이 없는 글과 목록 화면이 쓴다. */
export function siteDescription(blog: Blog): string | undefined {
  const { description, tagline } = blog.site.info;
  return description ?? tagline;
}

/** 글의 설명: 요약, 없으면 사이트 설명. 공유 미리보기와 피드가 같은 규칙을 쓴다. */
export function postDescription(blog: Blog, post: Post): string | undefined {
  return post.summary ?? siteDescription(blog);
}

export function pageDescription(blog: Blog, page: Page): string | undefined {
  return page.summary ?? siteDescription(blog);
}

/** 언어만 쓴 설정(`ko`)에 붙일 대표 지역. 여기 없는 언어는 지역을 짐작하지 않고 `og:locale`을 내지 않는다. */
const DEFAULT_REGION: Record<string, string> = {
  ko: 'KR',
  en: 'US',
  ja: 'JP',
  zh: 'CN',
  fr: 'FR',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  pt: 'BR',
  ru: 'RU',
  nl: 'NL',
  pl: 'PL',
  tr: 'TR',
  id: 'ID',
  th: 'TH',
  vi: 'VN',
  sv: 'SE',
  da: 'DK',
  fi: 'FI',
  cs: 'CZ',
  el: 'GR',
  hu: 'HU',
  uk: 'UA',
  he: 'IL',
  hi: 'IN',
};

/** Open Graph의 `og:locale`은 `ko_KR` 모양이다. 설정이 `ko-KR`이면 그대로 바꾸고, `ko`처럼 언어뿐이면 대표 지역을 붙인다. */
export function ogLocale(language: string): string | undefined {
  const [lang = '', region] = language.split('-');
  const resolved = region ?? DEFAULT_REGION[lang];
  return resolved ? `${lang}_${resolved}` : undefined;
}

export interface Share {
  /** 공유 카드의 제목. 글 제목, 목록 이름, 홈이면 사이트 이름 */
  title: string;
  description?: string;
  route: Route;
  /** 이 화면의 이미지. 없으면 사이트의 기본 공유 이미지를 쓴다. */
  image?: MediaPath;
  /** 글이면 `article`과 발행 시각 */
  article?: { publishedTime: string };
}

/**
 * 공유 미리보기용 `<head>`: `og:*`와 `twitter:*`. 주소와 이미지는 절대 주소여야 해서 사이트 주소를 알 때만 넣는다
 * (`Blog.origin`). 프로젝트 사이트의 기준 경로(basePath)가 붙는다.
 */
export function shareMetadata(blog: Blog, share: Share): Metadata {
  const { title, description, route, article } = share;
  const image = share.image ?? blog.site.info.shareImage;
  const { origin, basePath } = blog;
  const imageUrl = origin && image ? absoluteUrl(origin, basePath, image) : undefined;
  const alt = image ? coverAlt(blog, image) || undefined : undefined;
  const images = imageUrl ? [{ url: imageUrl, alt }] : undefined;
  return {
    description,
    openGraph: {
      type: article ? 'article' : 'website',
      title,
      description,
      siteName: blog.site.info.name,
      locale: ogLocale(blog.site.info.language),
      url: origin ? absoluteUrl(origin, basePath, routePath(route)) : undefined,
      images,
      ...(article ? { publishedTime: article.publishedTime } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}
