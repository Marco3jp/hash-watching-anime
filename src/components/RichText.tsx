import type { Page, TextRun } from "../model/types.ts";
import type { PageFocus } from "../model/views.ts";

export function RichText({
  runs,
  pages,
  onOpen,
}: {
  runs: TextRun[];
  pages: Page[];
  onOpen: (focus: PageFocus) => void;
}) {
  return (
    <>
      {runs.map((run, index) => {
        const page = run.pageId
          ? pages.find((item) => item.id === run.pageId)
          : undefined;
        if (!page) return <span key={index}>{run.text}</span>;
        return (
          <button
            key={index}
            type="button"
            className="border-b border-series/40 text-series hover:border-series"
            onClick={() => onOpen({ kind: page.kind, id: page.id })}
          >
            {run.text}
          </button>
        );
      })}
    </>
  );
}
