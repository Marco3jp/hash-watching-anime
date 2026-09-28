import { useState } from "react";
import typesSource from "../model/types.ts?raw";
import viewsSource from "../model/views.ts?raw";
import { Section } from "../components/Section.tsx";

const files = [
  { id: "types", label: "types.ts 保存する型", source: typesSource },
  { id: "views", label: "views.ts 画面用の組み立て", source: viewsSource },
] as const;

export function Source() {
  const [current, setCurrent] = useState<(typeof files)[number]["id"]>("types");
  const file = files.find((item) => item.id === current) ?? files[0];

  return (
    <Section
      id="source"
      index="07"
      title="TypeScript"
      lead="レビュー用の画面は、このファイルをそのまま表示している。見本データは src/model/example.ts。サイドパネルの中身は views.ts の結果。"
    >
      <div className="flex flex-wrap gap-2">
        {files.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrent(item.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              item.id === file.id
                ? "border-ink bg-ink text-paper-2"
                : "border-line bg-paper-2"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <pre className="mt-4 max-h-[640px] overflow-auto rounded-lg bg-ink p-4 font-mono text-[12px] leading-relaxed text-[#f3ecdf]">
        <code dangerouslySetInnerHTML={{ __html: highlight(file.source) }} />
      </pre>
    </Section>
  );
}

function highlight(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);
      if (/^\s*(\*|\/\*|\*\/|\/\/)/.test(line) || /^\s*\*/.test(line)) {
        return `<span class="text-[#d7b08a]">${escaped}</span>`;
      }
      return escaped.replace(
        /\b(export|import|type|interface|from|extends|null|string|number|boolean)\b/g,
        '<span class="text-[#f0c7b0]">$1</span>',
      );
    })
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
