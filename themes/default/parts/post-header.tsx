import { ThemeLink } from './link';

export interface PostHeaderProps {
  category: string;
  categoryHref?: string;
  title: string;
  summary?: string;
  date: string;
  readingTime?: string;
}

export function PostHeader({
  category,
  categoryHref,
  title,
  summary,
  date,
  readingTime,
}: PostHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <ThemeLink href={categoryHref ?? '#'} className="text-meta text-fg-default no-underline">
        {category}
      </ThemeLink>
      <h1 className="m-0 mt-2 text-post-title text-balance max-md:text-[36px] max-md:leading-11">
        {title}
      </h1>
      <p className="m-0 text-menu text-fg-muted">
        {[summary, date, readingTime].filter(Boolean).join(' · ')}
      </p>
    </header>
  );
}
