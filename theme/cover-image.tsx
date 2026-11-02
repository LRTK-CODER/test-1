export interface CoverImageProps {
  src?: string;
  alt?: string;
  /** 4x3 카드, 16x10 대표 글, 2x1 글 상세 상단 */
  ratio?: '4x3' | '16x10' | '2x1';
  /** src가 없을 때 accent 장식 도형을 그린다 */
  decorative?: boolean;
  /** src도 장식도 없을 때 자리에 보이는 안내 글자 */
  label?: string;
}

const RATIO = {
  '4x3': 'aspect-[4/3]',
  '16x10': 'aspect-[16/10]',
  '2x1': 'aspect-[2/1]',
};

/** 이미지가 없으면 bg-media 자리를 보여 준다. */
export function CoverImage({ src, alt, ratio = '4x3', decorative, label }: CoverImageProps) {
  const base = `w-full max-w-full overflow-hidden rounded-xl bg-bg-media ${RATIO[ratio]}`;
  if (src) {
    // biome-ignore lint/performance/noImgElement: 정적 내보내기에서는 이미지 최적화를 쓰지 않는다
    return <img src={src} alt={alt ?? ''} className={`${base} object-cover`} />;
  }
  if (decorative) {
    return (
      <div aria-hidden="true" className={`${base} flex items-center justify-center gap-3`}>
        <span className="aspect-square w-[22%] rounded-[28%] bg-bg-subtle" />
        <span className="aspect-[1/2] w-[22%] rounded-full bg-accent" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={alt || '대표 이미지 없음'}
      className={`${base} flex items-end px-[18px] py-4 text-small text-fg-on-media`}
    >
      {label}
    </div>
  );
}
