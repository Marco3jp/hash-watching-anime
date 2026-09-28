import { exampleDb } from "../model/example.ts";
import type { PageFocus } from "../model/views.ts";
import { openSeries } from "../model/views.ts";

const shortName: Record<string, string> = {
  "s-tv1": "1期",
  "s-ren": "戀",
  "s-kai": "六花・改",
  "s-tom": "Take On Me",
};

export function ExampleMap({
  focus,
  onOpen,
}: {
  focus: PageFocus;
  onOpen: (focus: PageFocus) => void;
}) {
  const activeSeriesId =
    focus.kind === "series"
      ? focus.id
      : focus.kind === "episode"
        ? exampleDb.episodes.find((item) => item.id === focus.id)?.seriesId
        : undefined;
  const episodes = exampleDb.episodes
    .filter((item) => item.seriesId === activeSeriesId)
    .slice()
    .sort((a, b) => a.sortKey - b.sortKey);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[720px] flex-col gap-4">
          <div className="flex items-stretch gap-2">
            <SeriesNode
              id="s-tv1"
              active={activeSeriesId === "s-tv1"}
              onOpen={onOpen}
            />
            <Arrow label="続編" />
            <SeriesNode
              id="s-ren"
              active={activeSeriesId === "s-ren"}
              onOpen={onOpen}
            />
            <Arrow label="続編" />
            <SeriesNode
              id="s-tom"
              active={activeSeriesId === "s-tom"}
              onOpen={onOpen}
            />
          </div>
          <div className="flex items-center gap-2 pl-8">
            <Arrow label="1期から総集編" />
            <SeriesNode
              id="s-kai"
              active={activeSeriesId === "s-kai"}
              onOpen={onOpen}
            />
          </div>
        </div>
      </div>
      {activeSeriesId ? (
        <div className="mt-5">
          <p className="text-sm text-muted">
            {exampleDb.series.find((item) => item.id === activeSeriesId)?.title}
            の話。カードを押すと下の画面が変わる。
          </p>
          {episodes.length === 0 ? (
            <p className="mt-2 text-sm">
              見本には話を置いていない。シリーズのページだけ開く。
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {episodes.map((episode) => {
                const selected =
                  focus.kind === "episode" && focus.id === episode.id;
                return (
                  <button
                    key={episode.id}
                    type="button"
                    onClick={() => onOpen({ kind: "episode", id: episode.id })}
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
      ) : null}
      <p className="mt-4 max-w-3xl text-sm text-muted">
        1期の話は第1話、第2話、最終話だけ入れてある。間が無いので、第2話の次は最終話になる。戀の各話は置いていない。Take
        On Me への話リンクは、最終話の正式なサブタイトルを例に使わず空のまま。
      </p>
    </div>
  );
}

function SeriesNode({
  id,
  active,
  onOpen,
}: {
  id: string;
  active: boolean;
  onOpen: (focus: PageFocus) => void;
}) {
  const series = exampleDb.series.find((item) => item.id === id);
  if (!series) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(openSeries(exampleDb, series.id))}
      className={`w-44 shrink-0 rounded-lg border px-3 py-3 ${
        active
          ? "border-series bg-series text-paper-2"
          : "border-line bg-paper-2 hover:border-series"
      }`}
    >
      <span
        className={`font-mono text-[10px] tracking-widest ${
          active ? "text-white/70" : "text-muted"
        }`}
      >
        {series.unit === "single" ? "SINGLE" : "SERIAL"}
      </span>
      <span className="mt-1 block font-serif text-lg leading-snug">
        {shortName[id]}
      </span>
      <span
        className={`mt-1 block text-xs leading-snug ${
          active ? "text-white/75" : "text-muted"
        }`}
      >
        {series.title}
      </span>
    </button>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1 self-center text-xs text-muted">
      <span className="max-w-24 text-center leading-tight">{label}</span>
      <span aria-hidden className="text-base text-seal">
        →
      </span>
    </div>
  );
}
