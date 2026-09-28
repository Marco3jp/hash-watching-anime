import { Section } from "../components/Section.tsx";
import { questions } from "../content.ts";

export function Questions() {
  const groups = [...new Set(questions.map((item) => item.group))];
  return (
    <Section
      id="questions"
      index="03"
      title="確認したいこと"
      lead="1st は話、シリーズ、キャラクターのサイドパネルまで。ここから先は、まだ作らない。"
    >
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group}>
            <h3 className="font-mono text-xs tracking-[0.16em] text-muted">
              {group}
            </h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {questions
                .filter((item) => item.group === group)
                .map((item) => (
                  <article
                    key={item.id}
                    className="border-l-4 border-seal bg-paper-2 px-4 py-4"
                  >
                    <h4 className="font-serif text-lg">{item.title}</h4>
                    <p className="mt-2 text-sm">{item.detail}</p>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
