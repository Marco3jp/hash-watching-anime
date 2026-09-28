import type { Page } from "../model/types.ts";
import type { PageFocus } from "../model/views.ts";

export function RichText({
  text,
  pages,
  onOpen,
}: {
  text: string;
  pages: Page[];
  onOpen: (focus: PageFocus) => void;
}) {
  const parts = text.split(/(\[\[[^\]\n]+\]\])/g);
  return (
    <>
      {parts.map((part, index) => {
        const matched = part.match(/^\[\[([^\]\n]+)\]\]$/);
        if (!matched) return <span key={index}>{part}</span>;
        const raw = matched[1].trim();
        const hits = pages.filter(
          (page) => page.title === raw || page.aliases.includes(raw),
        );
        if (hits.length !== 1) {
          return (
            <span
              key={index}
              className="border-b border-dashed border-seal/70 text-seal"
              title="ページが一つに定まらない"
            >
              {raw}
            </span>
          );
        }
        const page = hits[0];
        return (
          <button
            key={index}
            type="button"
            className="border-b border-series/40 text-series hover:border-series"
            onClick={() => onOpen({ kind: page.kind, id: page.id })}
          >
            {raw}
          </button>
        );
      })}
    </>
  );
}
