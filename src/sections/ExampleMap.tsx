import { exampleDb } from "../model/example.ts";
import { openSeries, type PageFocus } from "../model/views.ts";

export function ExampleMap({
  focus,
  onOpen,
}: {
  focus: PageFocus;
  onOpen: (focus: PageFocus) => void;
}) {
  return (
    <div className="space-y-5">
      {exampleDb.series.map((series) => {
        const episodes = exampleDb.episodes
          .filter((item) => item.seriesId === series.id)
          .slice()
          .sort((a, b) => a.sortKey - b.sortKey);
        const seriesSelected =
          focus.kind === "series"
            ? focus.id === series.id
            : focus.kind === "episode" &&
              episodes.some((item) => item.id === focus.id);
        return (
          <div key={series.id}>
            <button
              type="button"
              onClick={() => onOpen(openSeries(exampleDb, series.id))}
              className={`rounded-lg border px-3 py-2 text-left ${
                seriesSelected
                  ? "border-series bg-series text-paper-2"
                  : "border-line bg-paper-2 hover:border-series"
              }`}
            >
              <span
                className={`font-mono text-[10px] tracking-widest ${
                  seriesSelected ? "text-white/70" : "text-muted"
                }`}
              >
                {series.unit === "single" ? "SINGLE" : "SERIAL"}
              </span>
              <span className="mt-1 block font-serif text-lg leading-snug">
                {series.title}
              </span>
            </button>
            {episodes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">話はまだ無い。</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {episodes.map((episode) => {
                  const selected =
                    focus.kind === "episode" && focus.id === episode.id;
                  return (
                    <button
                      key={episode.id}
                      type="button"
                      onClick={() =>
                        onOpen({ kind: "episode", id: episode.id })
                      }
                      className={`rounded-md border px-3 py-2 text-sm ${
                        selected
                          ? "border-episode bg-episode text-paper-2"
                          : "border-line bg-paper-2 hover:border-episode"
                      }`}
                    >
                      <span className="font-medium">{episode.label}</span>
                      <span className={selected ? "text-white/80" : "text-muted"}>
                        {" "}
                        {episode.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <p className="max-w-3xl text-sm text-muted">
        1期の話は第1話、第2話、最終話だけ入れてある。間が無いので、第2話の次は最終話になる。シリーズ同士の前後は、1st には入れていない。
      </p>
    </div>
  );
}
