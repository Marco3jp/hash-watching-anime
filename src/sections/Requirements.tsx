import { Section } from "../components/Section.tsx";
import { requirements } from "../content.ts";

export function Requirements() {
  return (
    <Section
      id="requirements"
      index="02"
      title="要件"
      lead="実況に要る範囲。スタッフと楽曲は、この一覧に入れていない。"
    >
      <ol className="space-y-3">
        {requirements.map((item, index) => (
          <li
            key={item.text}
            className="grid gap-2 rounded-lg border border-line bg-paper-2 px-4 py-3 md:grid-cols-[auto_1fr_16rem] md:items-start md:gap-4"
          >
            <span className="font-mono text-sm text-seal">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p>{item.text}</p>
            <p className="text-sm text-muted">{item.note}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
