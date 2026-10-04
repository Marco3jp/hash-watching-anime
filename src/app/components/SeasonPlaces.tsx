import type { Season } from "../../model/types.ts";
import type { SeasonPlace } from "../../model/views.ts";
import { PageLink } from "./PageFrame.tsx";

/**
 * シーズンが入っているシリーズと、その並びでの前後のシーズン。
 * 続編や前作へは、ここから行き来する
 */
export function SeasonPlaces({ places }: { places: SeasonPlace[] }) {
  if (places.length === 0) return null;
  return (
    <div className="space-y-4">
      {places.map((place) => (
        <div key={place.series.id} className="space-y-1.5">
          <p className="flex items-baseline gap-3">
            <PageLink page={place.series} />
            {place.note ? <span className="text-xs text-muted">{place.note}</span> : null}
          </p>
          <Neighbor caption="前" season={place.previous} />
          <Neighbor caption="次" season={place.next} />
        </div>
      ))}
    </div>
  );
}

function Neighbor({ caption, season }: { caption: string; season: Season | null }) {
  return (
    <p className="flex items-baseline gap-3 text-sm">
      <span className="w-4 shrink-0 text-xs text-muted">{caption}</span>
      {season ? <PageLink page={season} /> : <span className="text-muted">なし</span>}
    </p>
  );
}
