import { useState } from "react";
import { Link, useRouteError } from "react-router-dom";
import { downloadJson } from "../download.ts";
import { useStore } from "../store.ts";

/**
 * 保存したデータを読めなかったとき、Layout の中身の代わりに出す。
 * 何も書き込まない。持ち出してからでないと、空から始められない。
 */
export function BrokenStorage({ message }: { message: string }) {
  const store = useStore();
  const [saved, setSaved] = useState(false);
  return (
    <div className="max-w-3xl py-10">
      <h1 className="text-2xl font-semibold">保存したデータを読めない</h1>
      <p className="mt-3 text-sm whitespace-pre-line text-danger">{message}</p>
      <p className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            downloadJson("raw", store.dumpRaw());
            setSaved(true);
          }}
        >
          保存してあるデータをそのまま書き出す
        </button>
        <button
          type="button"
          className="btn"
          disabled={!saved}
          onClick={() => {
            if (window.confirm("読めないデータを外して始める")) store.discardBroken();
          }}
        >
          外して始める
        </button>
      </p>
    </div>
  );
}

/**
 * 画面の途中で例外が出たとき。データを持ち出せるようにしておく。
 * 各ページの例外は Layout の中に出す。Layout 自体の例外は、router で外枠を付けて出す。
 */
export function PageError() {
  const error = useRouteError();
  const store = useStore();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold">このページを開けない</h1>
      <p className="mt-3 text-sm whitespace-pre-line text-danger">{message}</p>
      <p className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn"
          onClick={() => downloadJson("raw", store.dumpRaw())}
        >
          保存してあるデータをそのまま書き出す
        </button>
        <Link to="/" className="link text-sm">
          ホームへ戻る
        </Link>
      </p>
    </div>
  );
}
