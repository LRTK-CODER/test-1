export interface SiteFooterProps {
  copyright: string;
  note?: string;
}

export function SiteFooter({
  copyright,
  note = 'LBS로 만들고 GitHub Pages에 배포했어요',
}: SiteFooterProps) {
  return (
    <footer className="border-t border-stroke-subtle">
      <div className="mx-auto flex max-w-page-max flex-wrap justify-between gap-2 px-5 py-8 text-meta text-fg-subtle">
        <span>{copyright}</span>
        <span>{note}</span>
      </div>
    </footer>
  );
}
