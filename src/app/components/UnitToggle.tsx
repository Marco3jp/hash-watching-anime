import type { SeriesUnit } from "../../model/types.ts";
import { unitLabel } from "../paths.ts";

/**
 * 複数話か、劇場版・単発か。選択肢が2つなので、ネイティブの select は使わずボタンを並べる。
 * select のプルダウンは OS とブラウザが描くので、ダークテーマで文字が見えなくなることがある。
 */
export function UnitToggle({
  value,
  onChange,
  size = "md",
}: {
  value: SeriesUnit;
  onChange: (unit: SeriesUnit) => void;
  size?: "md" | "sm";
}) {
  return (
    <div
      role="radiogroup"
      aria-label="話の数"
      className={`inline-flex shrink-0 rounded-lg border border-line bg-field p-0.5 ${
        size === "sm" ? "h-7" : "h-9"
      }`}
    >
      {(Object.keys(unitLabel) as SeriesUnit[]).map((unit) => (
        <button
          key={unit}
          type="button"
          role="radio"
          aria-checked={value === unit}
          onClick={() => onChange(unit)}
          className={`inline-flex cursor-pointer items-center justify-center rounded-md px-3 whitespace-nowrap transition-colors ${
            size === "sm" ? "text-xs" : "text-sm"
          } ${
            value === unit
              ? "bg-raised font-medium text-fg"
              : "text-muted hover:text-fg"
          }`}
        >
          {unitLabel[unit]}
        </button>
      ))}
    </div>
  );
}
