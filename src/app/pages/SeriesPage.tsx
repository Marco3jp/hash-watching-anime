import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  addSeriesSeason,
  createSeason,
  deleteSeries,
  moveSeriesSeason,
  removeSeriesSeason,
  updateSeries,
  updateSeriesSeason,
} from "../../model/records.ts";
import type { Database, Series } from "../../model/types.ts";
import { buildSeriesSidePanel } from "../../model/views.ts";
import { BodyEditor } from "../components/BodyEditor.tsx";
import { CopyMenu } from "../components/CopyMenu.tsx";
import { InlineText } from "../components/InlineText.tsx";
import { MoveButton } from "../components/MoveButton.tsx";
import {
  DeleteButton,
  Missing,
  PageFrame,
  PageLink,
  RemoveButton,
  SideBlock,
} from "../components/PageFrame.tsx";
import { PageSuggest } from "../components/PageSuggest.tsx";
import { TitleFields } from "../components/TitleFields.tsx";
import { paths, unitLabel } from "../paths.ts";
import { useDatabase, useStore } from "../store.ts";

export function SeriesPage() {
  const { id } = useParams<"id">();
  const db = useDatabase();
  const series = db.series.find((item) => item.id === id);
  if (!series) {
    // v1 の /series/:id はいまのシーズン。id は移行で変えていないので、シーズンの面へ送る
    if (id && db.seasons.some((item) => item.id === id)) {
      return <Navigate to={paths.season(id)} replace />;
    }
    return <Missing what="このシリーズ" />;
  }
  return <SeriesView key={series.id} db={db} series={series} />;
}

function SeriesView({ db, series }: { db: Database; series: Series }) {
  const store = useStore();
  const navigate = useNavigate();
  const panel = buildSeriesSidePanel(db, series.id);
  const update = (patch: Parameters<typeof updateSeries>[2]) =>
    store.update((draft) => updateSeries(draft, series.id, patch));

  return (
    <PageFrame
      kicker="シリーズ"
      header={
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[min(100%,20rem)] flex-1">
            <TitleFields
              page={series}
              prefix="#"
              onTitle={(title) => update({ title })}
              onAliases={(aliases) => update({ aliases })}
            />
          </div>
          <CopyMenu page={series} />
          <DeleteButton
            message={`「${series.title}」を消す`}
            onDelete={() => {
              store.update((draft) => deleteSeries(draft, series.id));
              navigate(paths.home);
            }}
          />
        </div>
      }
      body={<BodyEditor page={series} />}
      side={
        <>
          <SideBlock title="シーズン">
            <SeasonList db={db} series={series} panel={panel} />
          </SideBlock>
        </>
      }
    />
  );
}

/** 並びの順が前後。↑↓ で入れ替え、添え書きに「総集編」などを書く */
function SeasonList({
  db,
  series,
  panel,
}: {
  db: Database;
  series: Series;
  panel: ReturnType<typeof buildSeriesSidePanel>;
}) {
  const store = useStore();
  const listed = new Set(series.seasons.map((item) => item.seasonId));

  return (
    <div className="space-y-4">
      {panel.seasons.length === 0 ? null : (
        <ol className="space-y-3">
          {panel.seasons.map((row, index) => (
            <li key={row.rowId} className="group">
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1">
                  <PageLink page={row.season} />
                </span>
                <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <MoveButton
                    label={`${row.season.title} を前へ`}
                    disabled={index === 0}
                    onClick={() =>
                      store.update((draft) => moveSeriesSeason(draft, series.id, row.rowId, -1))
                    }
                  >
                    ↑
                  </MoveButton>
                  <MoveButton
                    label={`${row.season.title} を後ろへ`}
                    disabled={index === panel.seasons.length - 1}
                    onClick={() =>
                      store.update((draft) => moveSeriesSeason(draft, series.id, row.rowId, 1))
                    }
                  >
                    ↓
                  </MoveButton>
                </span>
                <RemoveButton
                  label={`${row.season.title} をシリーズから外す`}
                  onClick={() =>
                    store.update((draft) => removeSeriesSeason(draft, series.id, row.rowId))
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted">
                  {row.season.unit === "single"
                    ? unitLabel.single
                    : `${row.episodes} 話`}
                </span>
                <InlineText
                  label={`${row.season.title} の添え書き`}
                  value={row.note}
                  placeholder="総集編など"
                  onCommit={(note) =>
                    store.update((draft) =>
                      updateSeriesSeason(draft, series.id, row.rowId, { note }),
                    )
                  }
                  className="text-xs text-muted"
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      <PageSuggest
        label="シリーズに入れるシーズン"
        placeholder="シーズンを入れる"
        pages={db.seasons.filter((item) => !listed.has(item.id))}
        hintOf={(season) => season.aliases.join("、") || undefined}
        onPick={(season) =>
          store.update((draft) => addSeriesSeason(draft, series.id, { seasonId: season.id }))
        }
        onCreate={(title) =>
          store.update((draft) => {
            const season = createSeason(draft, { title, unit: "serial" });
            addSeriesSeason(draft, series.id, { seasonId: season.id });
          })
        }
        createLabel={(text) => `「${text}」を作って入れる`}
      />
    </div>
  );
}
