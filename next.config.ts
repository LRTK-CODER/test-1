import type { NextConfig } from 'next';

// GitHub Pages 프로젝트 사이트는 /저장소이름 아래에서 열린다. 빌드 때 NEXT_PUBLIC_BASE_PATH로 받아 쓰고,
// 없으면 루트(사용자 사이트나 사용자 도메인)에서 연다. `/repo`와 `repo`를 모두 받는다.
const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
const basePath = raw ? `/${raw}` : undefined;

const config: NextConfig = {
  output: 'export',
  basePath,
  // 정적 호스팅에서 /posts/<slug>/ 가 index.html로 열리게 한다(#36)
  trailingSlash: true,
  images: { unoptimized: true },
  // 결과물 폴더. 기본은 out/ 이고, 시험에서만 LBS_OUT_DIR로 바꾼다.
  distDir: process.env.LBS_OUT_DIR || undefined,
  // 빌드 시각을 한 번만 정한다. 메뉴·이동 기록·글 목록이 모두 같은 시각으로 공개 여부를 판단한다.
  env: { LBS_BUILD_TIME: process.env.LBS_NOW || new Date().toISOString() },
  transpilePackages: ['@lbs/schema', '@lbs/theme-kit'],
  devIndicators: false,
  agentRules: false,
};

export default config;
