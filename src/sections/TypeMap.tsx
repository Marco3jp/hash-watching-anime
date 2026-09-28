import { useState } from "react";
import { Section } from "../components/Section.tsx";
import { groupLabel, typeDocs, type TypeDoc } from "../content.ts";

const groups: TypeDoc["group"][] = ["work", "people", "music", "view"];

export function TypeMap() {
  const [selectedId, setSelectedId] = useState("Episode");
  const selected = typeDocs.find((item) => item.id === selectedId) ?? typeDocs[0];

  return (
    <Section
      id="types"
      index="06"
      title="型の地図"
      lead="保存するのは実線のカード。点線のカードは、ページを開いたときに組む形で、データベースには置かない。"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group}>
              <h3 className="font-mono text-xs tracking-[0.16em] text-muted">
                {groupLabel[group]}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {typeDocs
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const active = item.id === selected.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`rounded-md border px-3 py-2 ${
                          active
                            ? "border-ink bg-ink text-paper-2"
                            : item.group === "view"
                              ? "border-dashed border-muted bg-transparent"
                              : "border-line bg-paper-2 hover:border-ink"
                        }`}
                      >
                        <span className="block font-mono text-sm">
                          {item.name}
                        </span>
                        <span
                          className={`block text-xs ${
                            active ? "text-white/70" : "text-muted"
                          }`}
                        >
                          {item.page}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
          <ol className="space-y-2 text-sm">
            <li>Series 1つに Episode が並ぶ。並びは sortKey。</li>
            <li>前後は series.links。話への明示的な続きは episode.links。</li>
            <li>名簿は series.characters。出演の印は episode.appearances。</li>
            <li>
              キャラクターデザインは series.credits。絵コンテは episode.credits。話を開いたらこの二つを並べる。
            </li>
            <li>曲の使い方は series.songs。名義は song.credits。</li>
            <li>人物ページの担当一覧だけ、各ページの credits を歩く。</li>
            <li>本文の [[名前]] は id を保存しない。表示するときに title と aliases で引く。</li>
          </ol>
        </div>
        <aside className="h-fit rounded-lg border border-line bg-paper-2 p-4 lg:sticky lg:top-24">
          <p className="font-mono text-[11px] tracking-[0.16em] text-seal">
            {selected.page}
          </p>
          <h3 className="font-mono text-xl">{selected.name}</h3>
          <p className="mt-2 text-sm">{selected.summary}</p>
          <h4 className="mt-4 font-mono text-[11px] tracking-[0.14em] text-muted">
            フィールド
          </h4>
          <ul className="mt-1 space-y-1 font-mono text-xs leading-relaxed">
            {selected.fields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <h4 className="mt-4 font-mono text-[11px] tracking-[0.14em] text-muted">
            つながり
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {selected.ties.map((tie) => (
              <li key={tie}>{tie}</li>
            ))}
          </ul>
        </aside>
      </div>
    </Section>
  );
}
