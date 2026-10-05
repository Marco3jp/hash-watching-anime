import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  applyTextEdit,
  blockTime,
  blockWithTime,
  fillTime,
  insertLink,
  linkAt,
  localTimestamp,
  mergeWithPrevious,
  plainText,
  replaceBlock,
  splitBlock,
  splitRuns,
  stampWritten,
} from "../../model/body.ts";
import { createCharacter, setBody } from "../../model/records.ts";
import { hasExactName, matchedName, suggestPages } from "../../model/search.ts";
import type { Database, MemoBlock, Page, TextRun } from "../../model/types.ts";
import { pagesOf } from "../../model/views.ts";
import { pageName, pathOf, hashName } from "../paths.ts";
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
 * 本文を、見ている面でそのまま直す。見た目は1枚の入力欄で、行ごとに左へ話の中の位置を出す。
 * 書いた時刻は、フォーカスしている行だけ、欄の左の外に出す。
 * Enter で次の行、Shift+Enter で行内の改行、行頭の Backspace で前の行へ寄せる。
 * 書いた時刻は、行に何か入ったときに入れる。
 * @ に続けて打つと、ページのサジェストが開く。選んだページの id を TextRun.pageId に入れる。
 * clock を渡すと、まだ何も書いていない行に書き始めたとき、その位置を話の中の時刻に入れる。
 */
export function BodyEditor({
  page,
  clock,
}: {
  page: Page;
  /** 話の中のいまの位置。「11:10」。数えていなければ null */
  clock?: () => string | null;
}) {
  const store = useStore();
  const db = useDatabase();
  const [emptyId] = useState(() => crypto.randomUUID());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = useRef<{ id: string; offset: number } | null>(null);

  const blocks: MemoBlock[] =
    page.body.blocks.length > 0
      ? page.body.blocks
      : [{ id: emptyId, at: null, writtenAt: null, runs: [] }];

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
    const blocks = stampWritten(next, localTimestamp(new Date()));
    store.update((draft) => setBody(draft, page.id, { blocks }));
  };

  const suggestable = orderForSuggest(db, page);
  const pageById = new Map(pagesOf(db).map((item) => [item.id, item]));
  const hrefOf = (pageId: string) => {
    const target = pageById.get(pageId);
    return target ? pathOf(db, target) : null;
  };
  const focusedAt = blocks.find((block) => block.id === focusedId)?.writtenAt ?? null;

  return (
    <div>
      <div className="rounded-lg border border-line bg-field py-1.5 focus-within:border-theme">
        {blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            onFocusRow={(focused) =>
              setFocusedId((current) => {
                if (focused) return block.id;
                return current === block.id ? null : current;
              })
            }
            pages={suggestable}
            hintOf={(item) => hintOf(db, item)}
            register={(area) => {
              if (area) areas.current.set(block.id, area);
              else areas.current.delete(block.id);
            }}
            onRuns={(runs, caret) =>
              commit(
                replaceBlock(blocks, block.id, (item) =>
                  fillTime(item, { ...item, runs }, clock?.() ?? null),
                ),
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
            onCreate={(title) =>
              store.update((draft) => createCharacter(draft, { title }))
            }
            hrefOf={hrefOf}
          />
        ))}
      </div>
      {/* 左の外に出す余白が無い幅では、フォーカスしている行の書いた時刻を欄の下に出す */}
      {focusedAt ? (
        <p className="mt-1 xl:hidden">
          <WrittenAt value={focusedAt} />
        </p>
      ) : null}
    </div>
  );
}

function BlockRow({
  block,
  onFocusRow,
  pages,
  hintOf,
  register,
  onRuns,
  onTime,
  onSplit,
  onMerge,
  onFocusSibling,
  onCreate,
  hrefOf,
}: {
  block: MemoBlock;
  onFocusRow: (focused: boolean) => void;
  pages: Page[];
  hintOf: (page: Page) => string | undefined;
  register: (area: HTMLTextAreaElement | null) => void;
  onRuns: (runs: TextRun[], caret?: number) => void;
  onTime: (at: string) => void;
  onSplit: (runs: TextRun[], offset: number) => void;
  onMerge: () => void;
  onFocusSibling: (direction: -1 | 1) => boolean;
  onCreate: (title: string) => Page;
  /** 本文のリンクの開く先。ページが無ければ null */
  hrefOf: (pageId: string) => string | null;
}) {
  const navigate = useNavigate();
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
      const name = matchedName(page, mention.query);
      options.push(
        name === page.title
          ? { type: "page", page, hint: hintOf(page) }
          : { type: "page", page, name, hint: pageName(page) },
      );
    }
    if (mention.query.trim() && !hasExactName(pages, mention.query)) {
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
    // 別名で当たったときは、別名のまま差し込む。フルネームの題名を毎回書かずに済むように
    const result = insertLink(block.runs, mention.start, end, {
      text: option.type === "page" ? (option.name ?? target.title) : target.title,
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
    // リンクはクリックで開く。キーボードでは、リンクの上で Ctrl（Mac は ⌘）+Enter
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const pageId = linkAt(block.runs, start);
      const href = pageId ? hrefOf(pageId) : null;
      if (href) navigate(href);
      return;
    }
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
    <div
      onFocus={() => onFocusRow(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onFocusRow(false);
      }}
      className="group relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 pr-3"
    >
      {block.writtenAt ? (
        <span className="pointer-events-none absolute top-0 right-full mr-2 hidden text-right xl:group-focus-within:block">
          <WrittenAt value={block.writtenAt} stacked />
        </span>
      ) : null}
      <input
        aria-label="話の中の時刻"
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
        className="h-7 min-w-0 border-r border-line bg-transparent px-3 font-mono text-xs leading-7 text-theme outline-none placeholder:text-muted/60 focus:placeholder:text-muted"
      />
      <div className="relative leading-7">
        <div
          className="pointer-events-none min-h-7 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
        >
          <Backdrop
            runs={block.runs}
            hrefOf={hrefOf}
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
          className="absolute inset-0 z-10 block h-full w-full resize-none overflow-hidden bg-transparent p-0 text-transparent caret-fg outline-none whitespace-pre-wrap break-words [overflow-wrap:anywhere] placeholder:text-muted/70 selection:bg-theme/30"
        />
      </div>
    </div>
  );
}

/**
 * 現実で書いた時刻。書いたときの時差のまま、年月日と時分秒を出す。
 * stacked は行の左の外に出すとき。余白に収まるよう、年月日と時分秒を2段にして行の高さに合わせる。
 * 幅は年月日の10文字で決まり、時分秒の8文字は収まる。
 */
function WrittenAt({ value, stacked = false }: { value: string; stacked?: boolean }) {
  const date = value.slice(0, 10).replaceAll("-", "/");
  const time = value.slice(11, 19);
  return (
    <time
      dateTime={value}
      title={value}
      className={`whitespace-nowrap font-mono text-muted ${
        stacked ? "flex flex-col text-[10px] leading-[14px]" : "text-xs"
      }`}
    >
      {stacked ? (
        <>
          <span>{date}</span>
          <span>{time}</span>
        </>
      ) : (
        `${date} ${time}`
      )}
    </time>
  );
}

/**
 * textarea の下に同じ文字を並べ、リンクだけ色を付ける。サジェストは @ の位置に出す。
 * リンクは textarea の上に重ね、クリックでそのまま開く。リンクの外のクリックは textarea へ通す
 */
function Backdrop({
  runs,
  hrefOf,
  marker,
  markerAt,
}: {
  runs: TextRun[];
  hrefOf: (pageId: string) => string | null;
  marker: ReactNode;
  markerAt: number | null;
}) {
  const [before, after] =
    markerAt === null ? [runs, []] : splitRuns(runs, markerAt);
  const render = (items: TextRun[], prefix: string) =>
    items.map((run, index) => {
      const href = run.pageId ? hrefOf(run.pageId) : null;
      return href ? (
        <Link
          key={`${prefix}${index}`}
          to={href}
          tabIndex={-1}
          className="pointer-events-auto relative z-20 rounded-sm bg-theme/15 text-theme shadow-[inset_0_-1px_0_var(--theme)] hover:bg-theme/25"
        >
          {run.text}
        </Link>
      ) : (
        <span key={`${prefix}${index}`}>{run.text}</span>
      );
    });
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

/** キャラクターを先に、話、シーズン、シリーズの順に候補へ出す。開いているページ自身は外す */
function orderForSuggest(db: Database, page: Page): Page[] {
  return [...db.characters, ...db.episodes, ...db.seasons, ...db.series].filter(
    (item) => item.id !== page.id,
  );
}

function hintOf(db: Database, page: Page): string | undefined {
  if (page.kind === "episode") {
    const season = db.seasons.find((item) => item.id === page.seasonId);
    return season ? hashName(season) : undefined;
  }
  if (page.aliases.length > 0) return page.aliases.join("、");
  return undefined;
}
