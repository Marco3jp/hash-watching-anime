import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { tokenMarginMs } from "../sync/SyncController.ts";
import { paths } from "./paths.ts";
import { useSync, useSyncState } from "./store.ts";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 font-medium ${isActive ? "text-theme-dark" : "text-theme hover:text-theme-dark"}`;

export function Layout() {
  const navigate = useNavigate();
  const sync = useSync();
  const [text, setText] = useState("");

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = text.trim();
    if (query) navigate(paths.search(query));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          {/* 見せる名前は #watching_anime。# を印にして、実況のハッシュタグに見せる。保存キーやパッケージ名は hash-watching-anime のまま */}
          <Link
            to={paths.home}
            aria-label="#watching_anime"
            className="flex items-center gap-1.5 font-semibold text-theme"
          >
            <span
              aria-hidden
              className="inline-flex size-6 items-center justify-center rounded-md bg-theme text-sm font-bold text-on-theme"
            >
              #
            </span>
            <span aria-hidden>watching_anime</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <NavLink to={paths.home} end className={navClass}>
              ホーム
            </NavLink>
            <NavLink to={paths.settings} className={navClass}>
              {sync ? "同期と書き出し" : "書き出しと読み込み"}
            </NavLink>
          </nav>
          <form
            onSubmit={onSearch}
            className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto"
            role="search"
          >
            <SyncBadge />
            <AuthStatus />
            <input
              type="search"
              aria-label="検索"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="field min-w-0 flex-1 sm:w-60 sm:flex-none"
            />
            <button type="submit" className="btn">
              探す
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto box-border w-full max-w-6xl flex-1 px-4 pt-8 pb-24">
        <Outlet />
      </main>
    </div>
  );
}

/** 同期できないときと、競合があるときだけ出す。どちらも設定で見る */
function SyncBadge() {
  const state = useSyncState();
  if (state.status === "error") {
    return (
      <Link to={paths.settings} className="shrink-0 text-sm text-danger">
        同期できない
      </Link>
    );
  }
  if (state.conflicts.length > 0) {
    return (
      <Link to={paths.settings} className="shrink-0 text-sm text-danger">
        競合 {state.conflicts.length}
      </Link>
    );
  }
  return null;
}

/** Google の認証。未認証と認証切れは、押すとつなぐ */
function AuthStatus() {
  const sync = useSync();
  const state = useSyncState();
  const now = useNow(30_000);
  if (!sync) return null;
  const left =
    state.status === "off" || state.status === "signed-out" || state.tokenExpiresAt === null
      ? 0
      : state.tokenExpiresAt - tokenMarginMs - now;
  if (left > 0) {
    return (
      <Link to={paths.settings} className="shrink-0 text-sm text-muted hover:text-fg">
        認証済（残{Math.ceil(left / 60_000)}分）
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void sync.connect()}
      className={`btn btn-sm shrink-0 ${state.status === "off" ? "" : "text-danger"}`}
    >
      {state.status === "off" ? "未認証" : "認証切れ（要再認証）"}
    </button>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
