export interface IntroProps {
  title: string;
  lead?: string;
}

export function Intro({ title, lead }: IntroProps) {
  return (
    <section className="flex flex-col gap-5">
      <h1 className="m-0 max-w-[900px] text-hero text-balance max-md:text-[44px] max-md:leading-[52px]">
        {title}
      </h1>
      {lead ? <p className="m-0 max-w-[560px] text-lead text-fg-muted">{lead}</p> : null}
    </section>
  );
}
