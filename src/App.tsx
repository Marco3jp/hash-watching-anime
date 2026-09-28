import { useState } from "react";
import { sampleFocus } from "./model/example.ts";
import type { PageFocus } from "./model/views.ts";
import { ExampleMap } from "./sections/ExampleMap.tsx";
import { Premise } from "./sections/Premise.tsx";
import { Questions } from "./sections/Questions.tsx";
import { Requirements } from "./sections/Requirements.tsx";
import { Screen } from "./sections/Screen.tsx";
import { Source } from "./sections/Source.tsx";
import { TypeMap } from "./sections/TypeMap.tsx";
import { Section } from "./components/Section.tsx";

const nav = [
  { href: "#premise", label: "前提" },
  { href: "#requirements", label: "要件" },
  { href: "#questions", label: "未決" },
  { href: "#map", label: "つながり" },
  { href: "#screen", label: "画面" },
  { href: "#types", label: "型" },
  { href: "#source", label: "定義" },
];

export default function App() {
  const [focus, setFocus] = useState<PageFocus>(sampleFocus);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <a href="#top" className="font-serif text-lg font-semibold">
            実況メモの型
          </a>
          <nav className="flex gap-1 overflow-x-auto text-sm">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full px-2.5 py-1 text-muted hover:bg-paper-2 hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main id="top" className="mx-auto max-w-6xl px-4 pb-24">
        <div className="py-12">
          <p className="font-mono text-xs tracking-[0.2em] text-seal">
            DESIGN REVIEW
          </p>
          <h1 className="mt-2 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            アニメ実況メモの要件とデータ構造
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            書くアプリそのものではない。Sparkling Journey
            を読んだうえで、ページの要件と、まだ揺れているところと、仮の型を並べた。
          </p>
        </div>
        <Premise />
        <Requirements />
        <Questions />
        <Section
          id="map"
          index="04"
          title="中二病で辿るつながり"
          lead="1期から戀へは続編、1期から六花・改へは総集編、戀から Take On Me へは続編。劇場版は single。カードを押すと、開く先のページが下に出る。"
        >
          <ExampleMap focus={focus} onOpen={setFocus} />
        </Section>
        <Section
          id="screen"
          index="05"
          title="開いたページ"
          lead="閲覧と編集は同じ面、という前提の見本。左が本文、右が関係するデータ。中身は保存しているレコードから組んでいる。"
        >
          <Screen focus={focus} onOpen={setFocus} />
        </Section>
        <TypeMap />
        <Source />
      </main>
    </div>
  );
}
