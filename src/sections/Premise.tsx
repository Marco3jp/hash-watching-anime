import { Section } from "../components/Section.tsx";

export function Premise() {
  return (
    <Section
      id="premise"
      index="01"
      title="Sparkling Journey から持ってくるもの"
      lead="読んだのは作品とタグの台帳。実況の本文も、シリーズの前後も、あそこには無い。だからリポジトリは分ける、が今の仮決め。"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-line bg-paper-2 p-5">
          <h3 className="font-serif text-xl">今ある台帳</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Work は uuid と title と workTags。</li>
            <li>
              WorkTag は Tag の中身と、その作品に付けた note を一緒に抱えている。
            </li>
            <li>Tag は uuid、name、description。</li>
            <li>
              TagRelation はタグ同士の無向リンク。weight は 20 から 100。note
              付き。親子のような有向関係は、モデルのコメントにあるとおり未実装。
            </li>
            <li>
              保存キーは app:works:v1、app:tags:v1、app:tag-relations:v1。
            </li>
            <li>
              説明やメモは、表示をクリックすると入力になり、フォーカスが外れると保存される。
            </li>
            <li>JSON の書き出しと読み込み、文字列の検索がある。</li>
          </ul>
          <p className="mt-4 text-sm text-muted">
            updateTag はタグ側だけを書き換える。作品の中にコピーされた Tag
            は追従しない。長い本文を同じ持ち方にすると、ここがそのまま痛い。
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper-2 p-5">
          <h3 className="font-serif text-xl">メモの方で残す感覚</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>リンクに、その場だけの note を持てる。</li>
            <li>ページを開いたまま、その面で直す。</li>
            <li>JSON で持ち出せる。</li>
            <li>文字列で探せる。</li>
          </ul>
          <p className="mt-4 text-sm">
            参照は id だけにする。相手のタイトルをリンク側へコピーしない。Tag
            と TagRelation
            は、自由な分類が必要になったときに隣へ足せる。今回の型には入れていない。
          </p>
        </article>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="rounded-lg bg-series px-4 py-4 text-paper-2">
          <p className="font-mono text-[11px] tracking-widest text-white/70">
            SPARKLING JOURNEY
          </p>
          <p className="mt-2 font-serif text-lg">Work が Tag を抱える</p>
          <p className="mt-1 text-sm text-white/80">
            タグ同士は無向で、重みがある。話、人物、本文のページは無い。
          </p>
        </div>
        <div className="hidden items-center justify-center font-serif text-2xl text-muted md:flex">
          →
        </div>
        <div className="rounded-lg bg-episode px-4 py-4 text-paper-2">
          <p className="font-mono text-[11px] tracking-widest text-white/70">
            このメモ
          </p>
          <p className="mt-2 font-serif text-lg">ページと、id だけのリンク</p>
          <p className="mt-1 text-sm text-white/85">
            話の本文が中心。シリーズの前後は有向。サイドパネルは保存値から組む。
          </p>
        </div>
      </div>
    </Section>
  );
}
