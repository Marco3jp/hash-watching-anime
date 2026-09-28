import type { ReactNode } from "react";

export function Section({
  id,
  index,
  title,
  lead,
  children,
}: {
  id: string;
  index: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line py-12">
      <p className="font-mono text-xs tracking-[0.18em] text-seal">{index}</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-3 max-w-3xl text-muted">{lead}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
