import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  applyTextEdit,
  blockTime,
  blockWithTime,
  insertLink,
  linkAt,
  mergeWithPrevious,
  plainText,
  replaceBlock,
  splitBlock,
  splitRuns,
} from "../../model/body.ts";
import { createCharacter, setBody } from "../../model/records.ts";
import { hasExactTitle, suggestPages } from "../../model/search.ts";
import type { Database, MemoBlock, Page, TextRun } from "../../model/types.ts";
import { pagesOf } from "../../model/views.ts";
import { pathOf, seriesName } from "../paths.ts";
import { useDatabase, useStore } from "../store.ts";
import { SuggestList } from "./SuggestList.tsx";
import { handleSuggestKey, type SuggestOption } from "./suggest.ts";

/** サジェストを開く文字。IME のまま打つと全角になる */
const TRIGGERS = ["@", "＠"];
const MAX_QUERY = 24;

interface Mention {
  start: number;
  query: string;
}

/**
 * 本文を、見ている面でそのまま直す。
 * Enter で次の行、Shift+Enter で行内の改行、行頭の Backspace で前の行へ寄せる。
 * @ に続けて打つと、ページのサジェストが開く。選んだページの id を TextRun.pageId に入れる。
 */
export function BodyEditor({ page }: { page: Page }) {
  const store = useStore();
  const db = useDatabase();
  const navigate = useNavigate();
  const [emptyId] = useState(() => crypto.randomUUID());
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = useRef<{ id: string; offset: number } | null>(null);

  const blocks: MemoBlock[] =
    page.body.blocks.length > 0
      ? page.body.blocks
      : [{ id: emptyId, type: "text", runs: [] }];

  useLayoutEffect(() => {
    const focus = pendingFocus.current;
    if (!focus) return;
    const area = areas.current.get(focus.id);
    if (!area) return;
    pendingFocus.current = null;
    area.focus();
    area.setSelectionRange(focus.offset, focus.offset);
  });

  const commit = (next: MemoBlock[], focus?: { id: string; offset: number }) => {
    if (focus) pendingFocus.current = focus;
    store.update((draft) => setBody(draft, page.id, { blocks: next }));
  };

  const suggestable = orderForSuggest(db, page);
  const pageIds = new Set(pagesOf(db).map((item) => item.id));

  return (
    <div className="space-y-0.5">
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          pages={suggestable}
          hintOf={(item) => hintOf(db, item)}
          register={(area) => {
            if (area) areas.current.set(block.id, area);
            else areas.current.delete(block.id);
          }}
          onRuns={(runs, caret) =>
            commit(
              replaceBlock(blocks, block.id, (item) => ({ ...item, runs })),
              caret === undefined ? undefined : { id: block.id, offset: caret },
            )
          }
          onTime={(at) => commit(replaceBlock(blocks, block.id, (item) => blockWithTime(item, at)))}
          onSplit={(runs, offset) => {
            const newId = crypto.randomUUID();
            const replaced = replaceBlock(blocks, block.id, (item) => ({ ...item, runs }));
            commit(splitBlock(replaced, block.id, offset, newId), { id: newId, offset: 0 });
          }}
          onMerge={() => {
            if (index === 0) {
              if (blocks.length > 1 && block.runs.length === 0 && blockTime(block) === "") {
                commit(blocks.slice(1), { id: blocks[1].id, offset: 0 });
              }
              return;
            }
            const merged = mergeWithPrevious(blocks, block.id);
            if (merged) commit(merged.blocks, merged.focus);
          }}
          onFocusSibling={(direction) => {
            const sibling = blocks[index + direction];
            if (!sibling) return false;
            const area = areas.current.get(sibling.id);
            if (!area) return false;
            area.focus();
            const offset = direction < 0 ? area.value.length : 0;
            area.setSelectionRange(offset, offset);
            return true;
          }}
          onOpen={(pageId) => {
            const target = db.series.find((item) => item.id === pageId) ??
              db.episodes.find((item) => item.id === pageId) ??
              db.characters.find((item) => item.id === pageId);
            if (target) navigate(pathOf(db, target));
          }}
          onCreate={(title) =>
            store.update((draft) => createCharacter(draft, { title }))
          }
          isLink={(pageId) => pageIds.has(pageId)}
        />
      ))}
    </div>
  );
}

function BlockRow({
  block,
  pages,
  hintOf,
  register,
  onRuns,
  onTime,
  onSplit,
  onMerge,
  onFocusSibling,
  onOpen,
  onCreate,
  isLink,
}: {
  block: MemoBlock;
  pages: Page[];
  hintOf: (page: Page) => string | undefined;
  register: (area: HTMLTextAreaElement | null) => void;
  onRuns: (runs: TextRun[], caret?: number) => void;
  onTime: (at: string) => void;
  onSplit: (runs: TextRun[], offset: number) => void;
  onMerge: () => void;
  onFocusSibling: (direction: -1 | 1) => boolean;
  onOpen: (pageId: string) => void;
  onCreate: (title: string) => Page;
  isLink: (pageId: string) => boolean;
}) {
  const text = plainText(block.runs);
  const [mention, setMention] = useState<Mention | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [time, setTime] = useState(blockTime(block));
  const [savedTime, setSavedTime] = useState(blockTime(block));
  if (blockTime(block) !== savedTime) {
    setSavedTime(blockTime(block));
    setTime(blockTime(block));
  }

  const open = mention !== null && mention.start !== dismissed;
  const options: SuggestOption[] = [];
  if (open) {
    for (const page of suggestPages(pages, mention.query)) {
      options.push({ type: "page", page, hint: hintOf(page) });
    }
    if (mention.query.trim() && !hasExactTitle(pages, mention.query)) {
      options.push({ type: "create", text: mention.query.trim() });
    }
  }

  const detect = (area: HTMLTextAreaElement) => {
    const found = findMention(area.value, area.selectionStart, area.selectionEnd, block.runs);
    setMention(found);
    if (!found || found.start !== mention?.start) setActive(0);
    if (!found) setDismissed(null);
  };

  const pick = (option: SuggestOption) => {
    if (!mention) return;
    const target = option.type === "page" ? option.page : onCreate(option.text);
    const end = mention.start + 1 + mention.query.length;
    const result = insertLink(block.runs, mention.start, end, {
      text: target.title,
      pageId: target.id,
    });
    setMention(null);
    onRuns(result.runs, result.caret);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (
      open &&
      handleSuggestKey(event, {
        options,
        active,
        setActive,
        pick,
        close: () => setDismissed(mention.start),
      })
    ) {
      return;
    }
    const area = event.currentTarget;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const runs = applyTextEdit(block.runs, area.value.slice(0, start) + area.value.slice(end));
      onSplit(runs, start);
      return;
    }
    if (event.key === "Backspace" && start === 0 && end === 0) {
      event.preventDefault();
      onMerge();
      return;
    }
    if (event.key === "ArrowUp" && start === 0 && end === 0) {
      if (onFocusSibling(-1)) event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown" && start === text.length && end === text.length) {
      if (onFocusSibling(1)) event.preventDefault();
    }
  };

  return (
    <div className="group -mx-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-md px-2 py-0.5 focus-within:bg-surface hover:bg-surface">
      <input
        aria-label="時刻"
        value={time}
        placeholder="--:--"
        onChange={(event) => setTime(event.target.value)}
        onBlur={() => {
          if (time !== blockTime(block)) onTime(time);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={`h-7 min-w-0 bg-transparent font-mono text-xs leading-7 text-theme outline-none placeholder:text-muted/50 ${
          time ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
        }`}
      />
      <div className="relative leading-7">
        <div
          className="pointer-events-none min-h-7 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
        >
          <Backdrop
            runs={block.runs}
            isLink={isLink}
            marker={
              open ? (
                <SuggestList
                  options={options}
                  active={active}
                  onPick={pick}
                  onHover={setActive}
                  createLabel={(value) => `キャラクター「${value}」を作ってリンク`}
                  className="pointer-events-auto absolute left-0 top-7"
                />
              ) : null
            }
            markerAt={open ? mention.start : null}
          />
          <span aria-hidden>{text.endsWith("\n") || text === "" ? "\u200b" : null}</span>
        </div>
        <textarea
          ref={register}
          aria-label="本文"
          value={text}
          rows={1}
          spellCheck={false}
          onChange={(event) => {
            onRuns(applyTextEdit(block.runs, event.target.value));
            detect(event.target);
          }}
          onSelect={(event) => detect(event.currentTarget)}
          onBlur={() => setMention(null)}
          onKeyDown={onKeyDown}
          onClick={(event) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            const pageId = linkAt(block.runs, event.currentTarget.selectionStart);
            if (pageId && isLink(pageId)) onOpen(pageId);
          }}
          className="absolute inset-0 z-10 block h-full w-full resize-none overflow-hidden bg-transparent p-0 text-transparent caret-fg outline-none whitespace-pre-wrap break-words [overflow-wrap:anywhere] placeholder:text-muted/70 selection:bg-theme/30"
        />
      </div>
    </div>
  );
}

/** textarea の下に同じ文字を並べ、リンクだけ色を付ける。サジェストは @ の位置に出す */
function Backdrop({
  runs,
  isLink,
  marker,
  markerAt,
}: {
  runs: TextRun[];
  isLink: (pageId: string) => boolean;
  marker: ReactNode;
  markerAt: number | null;
}) {
  const [before, after] =
    markerAt === null ? [runs, []] : splitRuns(runs, markerAt);
  const render = (items: TextRun[], prefix: string) =>
    items.map((run, index) =>
      run.pageId && isLink(run.pageId) ? (
        <span
          key={`${prefix}${index}`}
          className="rounded-sm bg-theme/15 text-theme shadow-[inset_0_-1px_0_var(--theme)]"
        >
          {run.text}
        </span>
      ) : (
        <span key={`${prefix}${index}`}>{run.text}</span>
      ),
    );
  return (
    <>
      <span aria-hidden>{render(before, "b")}</span>
      {markerAt === null ? null : <span className="relative">{marker}</span>}
      <span aria-hidden>{render(after, "a")}</span>
    </>
  );
}

/** caret の直前にある @ から caret までを、サジェストの問い合わせにする */
function findMention(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  runs: TextRun[],
): Mention | null {
  if (selectionStart !== selectionEnd) return null;
  const from = Math.max(0, selectionStart - MAX_QUERY - 1);
  for (let index = selectionStart - 1; index >= from; index -= 1) {
    const char = value[index];
    if (/\s/.test(char)) return null;
    if (TRIGGERS.includes(char)) {
      if (linkAt(runs, index)) return null;
      return { start: index, query: value.slice(index + 1, selectionStart) };
    }
  }
  return null;
}

/** キャラクターを先に、話、シリーズの順に候補へ出す。開いているページ自身は外す */
function orderForSuggest(db: Database, page: Page): Page[] {
  return [...db.characters, ...db.episodes, ...db.series].filter(
    (item) => item.id !== page.id,
  );
}

function hintOf(db: Database, page: Page): string | undefined {
  if (page.kind === "episode") {
    const series = db.series.find((item) => item.id === page.seriesId);
    return series ? seriesName(series) : undefined;
  }
  if (page.aliases.length > 0) return page.aliases.join("、");
  return undefined;
}
